import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { WeeklyRecapProcessor } from "../activity/weekly-recap.processor";
import type { Job } from "bullmq";
import { AppLogger } from "../../common/logger/app-logger.service";
import { AnalyticsRollupProcessor } from "../analytics/analytics-rollup.processor";
import { CallCleanupStaleProcessor } from "../calls/call-cleanup-stale.processor";
import { DatePlanReminderProcessor } from "../date-plans/date-plan-reminder.processor";
import { PassesCleanupExpiredProcessor } from "../likes/passes-cleanup-expired.processor";
import { MessageAttachmentModerationProcessor } from "../moderation/message-attachment-moderation.processor";
import { PhotoModerationProcessor } from "../moderation/photo-moderation.processor";
import { TrustScoreRecomputeProcessor } from "../moderation/trustscore-recompute.processor";
import { NotificationDispatchProcessor } from "../notification/notification-dispatch.processor";
import { SessionsCleanupInactiveProcessor } from "../sessions/sessions-cleanup-inactive.processor";
import { VibeMediaProcessor } from "../vibes/vibe-media.processor";
import { BlindEventsProcessor } from "../blind/blind-events.processor";

@Processor("default", {
  concurrency: 5,
})
export class DefaultQueueProcessor extends WorkerHost {
  constructor(
    private readonly notificationDispatchProcessor: NotificationDispatchProcessor,
    private readonly photoModerationProcessor: PhotoModerationProcessor,
    private readonly messageAttachmentModerationProcessor: MessageAttachmentModerationProcessor,
    private readonly analyticsRollupProcessor: AnalyticsRollupProcessor,
    private readonly trustScoreRecomputeProcessor: TrustScoreRecomputeProcessor,
    private readonly callCleanupStaleProcessor: CallCleanupStaleProcessor,
    private readonly passesCleanupExpiredProcessor: PassesCleanupExpiredProcessor,
    private readonly sessionsCleanupInactiveProcessor: SessionsCleanupInactiveProcessor,
    private readonly datePlanReminderProcessor: DatePlanReminderProcessor,
    private readonly vibeMediaProcessor: VibeMediaProcessor,
    private readonly logger: AppLogger,
    private readonly blindEventsProcessor: BlindEventsProcessor,
    private readonly weeklyRecapProcessor: WeeklyRecapProcessor,
  ) {
    super();
  }

  override async process(job: Job): Promise<void> {
    switch (job.name) {
      case "activity.weekly-recap":
        await this.weeklyRecapProcessor.process();
        return;
      case "blind.events.reconcile":
        await this.blindEventsProcessor.process();
        return;
      case "notification.dispatch":
        await this.notificationDispatchProcessor.process(job);
        return;
      case "photo.moderation":
        await this.photoModerationProcessor.process(job);
        return;
      case "message.attachment.moderation":
        await this.messageAttachmentModerationProcessor.process(job);
        return;
      case "analytics.rollup":
        await this.analyticsRollupProcessor.process(job);
        return;
      case "trustscore.recompute":
        await this.trustScoreRecomputeProcessor.process(job);
        return;
      case "call.cleanup.stale":
        await this.callCleanupStaleProcessor.process(job);
        return;
      case "passes.cleanup.expired":
        await this.passesCleanupExpiredProcessor.process(job);
        return;
      case "sessions.cleanup.inactive":
        await this.sessionsCleanupInactiveProcessor.process(job);
        return;
      case "date-plan.reminder":
        await this.datePlanReminderProcessor.process(job);
        return;
      case "vibe.media.process":
        await this.vibeMediaProcessor.process(job);
        return;
      default:
        this.logger.warn(`Ignoring unknown job ${job.name}`);
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      JSON.stringify({
        event: "worker.job.failed",
        jobName: job?.name ?? "unknown",
        jobId: job?.id ?? null,
        attemptsMade: job?.attemptsMade ?? null,
        failedReason: error.message,
      }),
      error.stack,
    );
  }
}
