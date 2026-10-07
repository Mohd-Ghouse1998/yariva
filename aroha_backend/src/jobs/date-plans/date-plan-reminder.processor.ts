import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { AppLogger } from "../../common/logger/app-logger.service";
import { PrismaService } from "../../database/prisma/prisma.service";
import { CreateNotificationService } from "../../modules/notifications/application/notifications.services";

export type DatePlanReminderJob = {
  datePlanId: string;
  kind: "DATE_REMINDER" | "SAFETY_CHECK_IN";
};

@Injectable()
export class DatePlanReminderProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: CreateNotificationService,
    private readonly logger: AppLogger,
  ) {}

  async process(job: Job<DatePlanReminderJob>): Promise<void> {
    const { datePlanId, kind } = job.data;
    const plan = await this.prisma.datePlan.findUnique({
      where: { id: datePlanId },
      include: { match: { select: { userLowId: true, userHighId: true } } },
    });

    // Delayed jobs are intentionally left in the queue when a plan changes. The
    // current database state is the source of truth, so cancelled or completed
    // dates can never produce stale reminders.
    if (!plan || plan.status !== "ACCEPTED") return;

    const isSafetyCheck = kind === "SAFETY_CHECK_IN";
    for (const userId of [plan.match.userLowId, plan.match.userHighId]) {
      try {
        await this.notifications.execute({
          userId,
          actorUserId: null,
          type: kind,
          title: isSafetyCheck ? "Are you okay?" : "Your date is coming up",
          body: isSafetyCheck
            ? "Check in privately, share the plan with someone you trust, or use the safety actions if you need support."
            : `${plan.title} is scheduled soon. Review the confirmed plan when it feels convenient.`,
          data: { matchId: plan.matchId, datePlanId: plan.id },
          dedupeKey: `${kind}:${plan.id}:${plan.proposalVersion}:${userId}`,
        });
      } catch (error) {
        this.logger.warn(
          `Date-plan reminder failed for one recipient: ${error instanceof Error ? error.name : "unknown"}`,
        );
      }
    }
  }
}
