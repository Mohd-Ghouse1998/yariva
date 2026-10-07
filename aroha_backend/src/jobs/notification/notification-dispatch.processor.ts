import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { NotificationDispatchService } from "../../modules/notifications/application/notifications.services";

@Injectable()
export class NotificationDispatchProcessor {
  constructor(
    private readonly notificationDispatchService: NotificationDispatchService,
  ) {}

  async process(job: Job): Promise<void> {
    await this.notificationDispatchService.execute(
      typeof job.data === "object" && job.data !== null
        ? (job.data as Record<string, unknown>)
        : {},
    );
  }
}

