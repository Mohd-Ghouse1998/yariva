import { NotificationDispatchProcessor } from "./notification-dispatch.processor";
import type { CreateNotificationService, NotificationDispatchService } from "../../modules/notifications/application/notifications.services";
import type { BullmqProducer } from "../../integrations/bullmq/bullmq.producer";

it("schedules durable notification recovery and propagates failures to worker retries", async () => {
  const recoverPending = jest.fn().mockResolvedValue(undefined);
  const scheduleRecurring = jest.fn().mockResolvedValue(undefined);
  const processor = new NotificationDispatchProcessor(
    {} as NotificationDispatchService,
    { recoverPending } as unknown as CreateNotificationService,
    { scheduleRecurring } as unknown as BullmqProducer,
  );
  await processor.onApplicationBootstrap();
  expect(scheduleRecurring).toHaveBeenCalledWith("notification.reconcile", 60_000);
  await processor.reconcile();
  expect(recoverPending).toHaveBeenCalledTimes(1);
  recoverPending.mockRejectedValueOnce(new Error("database unavailable"));
  await expect(processor.reconcile()).rejects.toThrow("database unavailable");
});
