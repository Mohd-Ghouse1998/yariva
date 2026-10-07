import { Injectable } from "@nestjs/common";
import { AppException } from "../../../common/errors/app.exception";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { EvaluateFeatureFlagService } from "../../feature-flags/application/feature-flags.services";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import { CreateNotificationService } from "../../notifications/application/notifications.services";
import {
  closedRecapPeriod,
  displayedStreak,
  istDay,
  RECAP_VERSION,
} from "../domain/activity.domain";
import type {
  ActivityPreferencesDto,
  ActivitySummaryDto,
  WeeklyRecapDto,
} from "../dto/activity.dto";

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: CreateNotificationService,
    private readonly flags: EvaluateFeatureFlagService,
  ) {}
  private async enabled(userId: string): Promise<boolean> {
    return (await this.flags.execute({ key: "activity.v1", userId })).enabled;
  }
  /** Internal only: caller already owns the publication transaction. DB supplies time/day and awards synchronously. */
  async recordScene(
    tx: PrismaTransactionalClient,
    userId: string,
    sceneId: string,
  ): Promise<void> {
    await tx.$executeRaw`INSERT INTO "QualifyingActivity"("userId","sceneId") VALUES(${userId}::uuid,${sceneId}::uuid) ON CONFLICT("sceneId") DO NOTHING`;
  }
  private async now(): Promise<Date> {
    const [row] = await this.prisma.$queryRaw<
      Array<{ now: Date }>
    >`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`;
    if (!row) throw new Error("Server clock unavailable");
    return row.now;
  }
  async summary(userId: string): Promise<ActivitySummaryDto> {
    const [row, now, enabled] = await Promise.all([
      this.prisma.userStreak.findUnique({ where: { userId } }),
      this.now(),
      this.enabled(userId),
    ]);
    return {
      enabled,
      currentStreak: displayedStreak(
        row?.currentStreak ?? 0,
        row?.lastActivityDate ?? null,
        now,
      ),
      longestStreak: row?.longestStreak ?? 0,
      balance: row?.balance ?? 0,
      lastActivityDate:
        row?.lastActivityDate?.toISOString().slice(0, 10) ?? null,
      displayEnabled: row?.displayEnabled ?? true,
      recapNotificationsEnabled: row?.recapNotificationsEnabled ?? false,
      serverDate: istDay(now),
    };
  }
  async preferences(
    userId: string,
    values: ActivityPreferencesDto,
  ): Promise<ActivitySummaryDto> {
    await this.prisma.userStreak.upsert({
      where: { userId },
      create: { userId, ...values },
      update: values,
    });
    return this.summary(userId);
  }
  async recap(userId: string): Promise<{ recap: WeeklyRecapDto }> {
    if (!(await this.enabled(userId)))
      throw new AppException(
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "Weekly recap is not available yet",
      );
    const now = await this.now();
    return { recap: await this.generate(userId, now) };
  }
  async generate(userId: string, now: Date): Promise<WeeklyRecapDto> {
    const period = closedRecapPeriod(now);
    // Serializable ownership lock ensures duplicate workers/read requests cannot create different snapshots.
    const report = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`recap:${userId}`},0))`;
      const existing = await tx.weeklyRecap.findUnique({
        where: {
          userId_periodStart_version: {
            userId,
            periodStart: period.start,
            version: RECAP_VERSION,
          },
        },
      });
      if (existing) return existing;
      const rollout = await tx.activityRollout.findUniqueOrThrow({
        where: { id: 1 },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { createdAt: true },
      });
      const historyStartedAt = new Date(
        Math.max(rollout.startedAt.getTime(), user.createdAt.getTime()),
      );
      const from = new Date(
        Math.max(period.start.getTime(), historyStartedAt.getTime()),
      );
      const [scenesPublished, plansAccepted, points] = await Promise.all([
        tx.qualifyingActivity.count({
          where: { userId, occurredAt: { gte: from, lt: period.end } },
        }),
        tx.acceptedPlanFact.count({
          where: {
            userIds: { has: userId },
            acceptedAt: { gte: from, lt: period.end },
          },
        }),
        tx.vibePointsLedger.aggregate({
          where: { userId, awardedAt: { gte: from, lt: period.end } },
          _count: true,
          _sum: { amount: true },
        }),
      ]);
      return tx.weeklyRecap.create({
        data: {
          userId,
          periodStart: period.start,
          periodEnd: period.end,
          version: RECAP_VERSION,
          scenesPublished,
          plansAccepted,
          activityDays: points._count,
          pointsEarned: points._sum.amount ?? 0,
          historyStartedAt,
        },
      });
    });
    const preferences = await this.prisma.userStreak.findUnique({
      where: { userId },
    });
    // Notification retries are independently deduped; failed generation never schedules a notification.
    if (preferences?.recapNotificationsEnabled)
      await this.notifications.execute({
        userId,
        type: "SYSTEM",
        channel: "PUSH",
        title: "Your week, recapped",
        body: "Your private Yariva recap is ready.",
        data: { route: "weekly-recap", recapId: report.id },
        dedupeKey: `recap:${report.id}`,
      });
    return {
      id: report.id,
      periodStart: report.periodStart.toISOString(),
      periodEnd: report.periodEnd.toISOString(),
      version: report.version,
      generatedAt: report.generatedAt.toISOString(),
      scenesPublished: report.scenesPublished,
      plansAccepted: report.plansAccepted,
      activityDays: report.activityDays,
      pointsEarned: report.pointsEarned,
      historyStartedAt: report.historyStartedAt.toISOString(),
      partialHistory: report.historyStartedAt > report.periodStart,
      historyAvailable: report.historyStartedAt < report.periodEnd,
    };
  }
  async reconcile(): Promise<void> {
    const now = await this.now();
    // Keyset batches avoid reading the whole audience into memory; opted-in active accounts only.
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.$queryRaw<
        Array<{ userId: string }>
      >`SELECT s."userId" FROM "UserStreak" s JOIN "User" u ON u.id=s."userId" WHERE s."recapNotificationsEnabled" AND u.status='ACTIVE' AND u."deletedAt" IS NULL AND (${cursor ?? null}::uuid IS NULL OR s."userId">${cursor ?? null}::uuid) ORDER BY s."userId" LIMIT 100`;
      if (!rows.length) return;
      for (const row of rows)
        if (await this.enabled(row.userId))
          await this.generate(row.userId, now);
      cursor = rows.at(-1)!.userId;
    }
  }
}
