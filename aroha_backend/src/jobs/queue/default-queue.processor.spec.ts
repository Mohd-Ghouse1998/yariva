import { DefaultQueueProcessor } from "./default-queue.processor";

describe("DefaultQueueProcessor", () => {
  it("routes known jobs to their processor", async () => {
    const notificationDispatchProcessor = { process: jest.fn() };
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
    );

    await processor.process({ name: "notification.dispatch" } as any);

    expect(notificationDispatchProcessor.process).toHaveBeenCalledTimes(1);
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
    );

    await processor.process({ name: "unknown.job" } as any);

    expect(logger.warn).toHaveBeenCalledWith("Ignoring unknown job unknown.job");
  });
});
