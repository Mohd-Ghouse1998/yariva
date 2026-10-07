import { BullmqProducer, toBullmqSafeJobId } from "./bullmq.producer";

describe("BullmqProducer", () => {
  it("normalizes custom job ids that BullMQ rejects", async () => {
    const queue = { add: jest.fn() };
    const producer = new BullmqProducer(queue as any);

    await producer.enqueue(
      "notification.dispatch",
      { notificationId: "notification-1" },
      { jobId: "notification.dispatch:notification-1" },
    );

    expect(queue.add).toHaveBeenCalledWith(
      "notification.dispatch",
      { notificationId: "notification-1" },
      expect.objectContaining({
        jobId: "notification.dispatch__notification-1",
      }),
    );
  });

  it("keeps normalization stable for existing callers", () => {
    expect(toBullmqSafeJobId("call.cleanup.stale:call-1:ring")).toBe(
      "call.cleanup.stale__call-1__ring",
    );
  });
});
