import { DefaultQueueProcessor } from "./default-queue.processor";

describe("DefaultQueueProcessor", () => {
  it("routes known jobs to their processor", async () => {
    const notificationDispatchProcessor = { process: jest.fn(), reconcile: jest.fn() };
    const attachmentCleanup = { process: jest.fn() };
    const processor = new DefaultQueueProcessor(
      notificationDispatchProcessor as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { warn: jest.fn(), error: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      attachmentCleanup as any,
    );

    await processor.process({ name: "notification.dispatch" } as any);

    expect(notificationDispatchProcessor.process).toHaveBeenCalledTimes(1);
    await processor.process({ name: "notification.reconcile" } as any);
    expect(notificationDispatchProcessor.reconcile).toHaveBeenCalledTimes(1);
    const upload = { objectKey: "messages/test" };
    await processor.process({ name: "message.attachment.cleanup", data: upload } as any);
    expect(attachmentCleanup.process).toHaveBeenCalledWith(upload);
  });

  it("ignores unknown jobs without throwing", async () => {
    const logger = { warn: jest.fn(), error: jest.fn() };
    const processor = new DefaultQueueProcessor(
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      logger as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
      { process: jest.fn() } as any,
    );

    await processor.process({ name: "unknown.job" } as any);

    expect(logger.warn).toHaveBeenCalledWith("Ignoring unknown job unknown.job");
  });
});
