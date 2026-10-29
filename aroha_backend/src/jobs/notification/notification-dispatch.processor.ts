import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import type { Job } from "bullmq";
import { BullmqProducer } from "../../integrations/bullmq/bullmq.producer";
import { CreateNotificationService, NotificationDispatchService } from "../../modules/notifications/application/notifications.services";

@Injectable()
export class NotificationDispatchProcessor implements OnApplicationBootstrap {
  constructor(
    private readonly notificationDispatchService: NotificationDispatchService,
    private readonly notifications: CreateNotificationService,
    private readonly queue: BullmqProducer,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.scheduleRecurring("notification.reconcile", 60_000);
  }

  async reconcile(): Promise<void> {
    await this.notifications.recoverPending();
  }

  async process(job: Job): Promise<void> {
    await this.notificationDispatchService.execute(
      typeof job.data === "object" && job.data !== null
        ? (job.data as Record<string, unknown>)
        : {},
    );
  }
}

