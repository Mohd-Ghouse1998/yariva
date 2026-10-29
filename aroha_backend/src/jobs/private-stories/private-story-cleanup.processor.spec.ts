import { PrivateStoryCleanupProcessor } from "./private-story-cleanup.processor";

describe("PrivateStoryCleanupProcessor", () => {
  const now = new Date("2026-10-19T00:00:00Z");
  const old = new Date("2026-10-17T00:00:00Z");
  const recent = new Date("2026-10-18T12:00:00Z");
  const queue = { scheduleRecurring: jest.fn() };
  const storage = { deleteObject: jest.fn(), listObjects: jest.fn() };
  const prisma = { $transaction: jest.fn(), $queryRaw: jest.fn(), privateStory: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn() } };
  const logger = { log: jest.fn(), error: jest.fn() };
  const processor = new PrivateStoryCleanupProcessor(queue as never, prisma as never, storage as never,
    { bucketMessageAttachments: "private-bucket" } as never, logger as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(callback => callback(prisma));
    prisma.$queryRaw.mockImplementation((_query, id) => {
      prisma.privateStory.findFirst.mockResolvedValue({ id, mediaBucket: id === "expired" ? "private-bucket" : null,
        mediaObjectKey: id === "expired" ? "private-stories/owner/used.clean.png" : null });
      return Promise.resolve([{ id }]);
    });
    prisma.privateStory.count.mockResolvedValue(0).mockResolvedValueOnce(1);
    prisma.privateStory.findMany.mockResolvedValueOnce([
      { id: "expired", mediaBucket: "private-bucket", mediaObjectKey: "private-stories/owner/used.clean.png" },
    ]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ mediaObjectKey: "private-stories/owner/used.clean.png" }]);
    storage.listObjects.mockResolvedValue({ objects: [
      { objectKey: "private-stories/owner/used.clean.png", lastModified: old },
      { objectKey: "private-stories/owner/orphan.png", lastModified: old },
      { objectKey: "private-stories/owner/recent.png", lastModified: recent },
    ], nextToken: undefined });
  });

  it("schedules retention and removes old records and unreferenced uploads", async () => {
    await processor.onApplicationBootstrap();
    await processor.process(now);
    expect(JSON.parse(logger.log.mock.calls[0]![0])).toMatchObject({
      event: "private-story.cleanup.started", pendingStories: 1,
    });
    expect(JSON.parse(logger.log.mock.calls.at(-1)![0])).toMatchObject({
      event: "private-story.cleanup.completed", remainingStories: 0,
    });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('"removedStories":1,"removedOrphans":1,"scannedObjects":3'));
    expect(queue.scheduleRecurring).toHaveBeenCalledWith("private-story.cleanup", 86_400_000);
    expect(prisma.privateStory.findMany.mock.calls[0]![0].where.OR).toEqual([
      { savedAt: null, deletedAt: null, expiresAt: { lt: new Date("2026-09-19T00:00:00Z") } },
      { deletedAt: { lt: new Date("2026-09-19T00:00:00Z") } },
    ]);
    expect(storage.deleteObject).toHaveBeenCalledWith({ bucket: "private-bucket", objectKey: "private-stories/owner/used.clean.png" });
    expect(prisma.privateStory.delete).toHaveBeenCalledWith({ where: { id: "expired" } });
    expect(storage.deleteObject).toHaveBeenCalledWith({ bucket: "private-bucket", objectKey: "private-stories/owner/orphan.png" });
    expect(storage.deleteObject).not.toHaveBeenCalledWith(expect.objectContaining({ objectKey: "private-stories/owner/recent.png" }));
  });

  it("continues across database and object pages without deleting referenced objects", async () => {
    prisma.privateStory.findMany.mockReset().mockResolvedValueOnce([{ id: "one" }])
      .mockResolvedValueOnce([{ id: "two" }]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ mediaObjectKey: "private-stories/keep" }]).mockResolvedValueOnce([]);
    storage.listObjects.mockReset().mockResolvedValueOnce({ objects: [
      { objectKey: "private-stories/keep", lastModified: old }], nextToken: "page-2" })
      .mockResolvedValueOnce({ objects: [{ objectKey: "private-stories/orphan", lastModified: old }], nextToken: undefined });
    await processor.process(now);
    expect(prisma.privateStory.delete).toHaveBeenCalledTimes(2);
    expect(storage.listObjects).toHaveBeenLastCalledWith({ bucket: "private-bucket", prefix: "private-stories/", continuationToken: "page-2" });
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
    expect(storage.deleteObject).toHaveBeenCalledWith({ bucket: "private-bucket", objectKey: "private-stories/orphan" });
  });

  it("rechecks retention after locking and skips rows changed or removed by another request", async () => {
    prisma.$queryRaw.mockImplementation(async () => { prisma.privateStory.findFirst.mockResolvedValue(null); return []; });
    await processor.process(now);
    expect(prisma.privateStory.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "expired", OR: expect.any(Array) }),
    }));
    expect(prisma.privateStory.delete).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalledWith(expect.objectContaining({ objectKey: "private-stories/owner/used.clean.png" }));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('"removedStories":0'));
  });

  it("retains the database row if object deletion fails", async () => {
    storage.deleteObject.mockRejectedValueOnce(new Error("storage offline"));
    await expect(processor.process(now)).rejects.toThrow("storage offline");
    expect(prisma.privateStory.delete).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining("cleanup.completed"));
    expect(JSON.parse(logger.error.mock.calls[0]![0])).toMatchObject({
      event: "private-story.cleanup.failed", stage: "retention", pendingStories: 1, removedStories: 0,
    });
    expect(logger.error.mock.calls[0]![0]).not.toContain("private-stories/owner");
    prisma.privateStory.findMany.mockReset().mockResolvedValueOnce([{ id: "expired",
      mediaBucket: "private-bucket", mediaObjectKey: "private-stories/owner/used.clean.png" }])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([{ mediaObjectKey: "private-stories/owner/used.clean.png" }]);
    await processor.process(now);
    expect(prisma.privateStory.delete).toHaveBeenCalledTimes(1);
  });

  it("retries database deletion after an already deleted object without losing the row", async () => {
    prisma.privateStory.delete.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(processor.process(now)).rejects.toThrow("database unavailable");
    expect(JSON.parse(logger.error.mock.calls[0]![0])).toMatchObject({ stage: "retention", removedStories: 0 });
    prisma.privateStory.findMany.mockReset().mockResolvedValueOnce([{ id: "expired",
      mediaBucket: "private-bucket", mediaObjectKey: "private-stories/owner/used.clean.png" }])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([{ mediaObjectKey: "private-stories/owner/used.clean.png" }]);
    await processor.process(now);
    expect(storage.deleteObject.mock.calls.filter(([input]) => input.objectKey.endsWith("used.clean.png"))).toHaveLength(2);
    expect(prisma.privateStory.delete).toHaveBeenCalledTimes(2);
  });

  it("identifies an orphan-scan failure after retention completes", async () => {
    storage.listObjects.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(processor.process(now)).rejects.toThrow("storage unavailable");
    expect(JSON.parse(logger.error.mock.calls[0]![0])).toMatchObject({ stage: "orphans", removedStories: 1 });
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining("cleanup.completed"));
  });

  it("propagates a backlog-read failure without reporting a successful cleanup", async () => {
    const failure = new Error("count unavailable");
    prisma.privateStory.count.mockReset().mockRejectedValueOnce(failure);
    await expect(processor.process(now)).rejects.toBe(failure);
    expect(JSON.parse(logger.error.mock.calls[0]![0])).toMatchObject({ stage: "backlog", pendingStories: null });
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });
});
