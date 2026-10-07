import { VibeModerationService } from "./vibe-moderation.service";

const pendingVibe = {
  id: "10000000-0000-4000-8000-000000000001",
  userId: "10000000-0000-4000-8000-000000000002",
  status: "PROCESSING",
  moderationStatus: "PENDING",
  processedBucket: "vibe-media",
  processedObjectKey: "ready.mp4",
  thumbnailBucket: "vibe-media",
  thumbnailObjectKey: "thumbnail.jpg",
  processingCompletedAt: new Date(),
  deletedAt: null,
};

describe("VibeModerationService", () => {
  const tx = {
    vibeMedia: { updateMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    vibeMedia: { findUnique: jest.fn() },
    $transaction: jest.fn((callback: (executor: typeof tx) => unknown) => callback(tx)),
  };
  const auditLog = {
    write: jest.fn().mockResolvedValue(undefined),
  };
  const service = new VibeModerationService(prisma as any, auditLog as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.vibeMedia.findUnique.mockResolvedValue(pendingVibe);
  });

  it("publishes only after an explicit approval and retires the prior Vibe", async () => {
    tx.vibeMedia.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    await expect(
      service.review({
        vibeId: pendingVibe.id,
        decision: "APPROVED",
        provider: "test-provider",
      }),
    ).resolves.toBe(true);

    expect(tx.vibeMedia.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: pendingVibe.id,
          status: "PROCESSING",
          moderationStatus: "PENDING",
        }),
        data: expect.objectContaining({
          status: "READY",
          moderationStatus: "APPROVED",
          moderationProvider: "test-provider",
        }),
      }),
    );
    expect(tx.vibeMedia.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: pendingVibe.userId,
          id: { not: pendingVibe.id },
          status: "READY",
        }),
      }),
    );
    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "vibe.moderation.approve" }),
      tx,
    );
  });

  it("keeps rejected content unpublished and records the reason", async () => {
    tx.vibeMedia.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      service.review({
        vibeId: pendingVibe.id,
        decision: "REJECTED",
        provider: "test-provider",
        reason: "Unsafe content",
      }),
    ).resolves.toBe(true);

    expect(tx.vibeMedia.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.vibeMedia.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          moderationStatus: "REJECTED",
          failureReason: "Unsafe content",
          readyAt: null,
        }),
      }),
    );
    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "vibe.moderation.reject" }),
      tx,
    );
  });

  it("does not re-apply a stale or duplicate moderation decision", async () => {
    prisma.vibeMedia.findUnique.mockResolvedValue({
      ...pendingVibe,
      status: "READY",
      moderationStatus: "APPROVED",
    });

    await expect(
      service.review({
        vibeId: pendingVibe.id,
        decision: "REJECTED",
        provider: "late-provider",
      }),
    ).resolves.toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auditLog.write).not.toHaveBeenCalled();
  });
});
