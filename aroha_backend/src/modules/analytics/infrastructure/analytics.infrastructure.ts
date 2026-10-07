import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { AnalyticsSource, Prisma } from "../../../generated/prisma/client";
import type { AnalyticsSummaryDto } from "../dto/analytics.dto";

@Injectable()
export class AnalyticsEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(
    executor: PrismaTransactionalClient,
    input: Array<{
      userId: string | null;
      sessionId: string | null;
      eventName: string;
      source: AnalyticsSource;
      properties: Prisma.InputJsonValue;
      occurredAt: Date;
    }>,
  ): Promise<number> {
    if (input.length === 0) {
      return 0;
    }

    const result = await executor.analyticsEvent.createMany({
      data: input,
    });
    return result.count;
  }
}

@Injectable()
export class AnalyticsSummaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async summarize(window: "24h" | "7d" | "30d"): Promise<AnalyticsSummaryDto> {
    const since = resolveWindowStart(window);
    const [
      signups,
      activeUsers,
      likes,
      matches,
      messages,
      reports,
      callAttempts,
    ] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: since } } }),
      this.prisma.like.count({ where: { createdAt: { gte: since } } }),
      this.prisma.match.count({ where: { matchedAt: { gte: since } } }),
      this.prisma.message.count({ where: { createdAt: { gte: since } } }),
      this.prisma.report.count({ where: { createdAt: { gte: since } } }),
      this.prisma.callSession.count({ where: { createdAt: { gte: since } } }),
    ]);

    return {
      window,
      metrics: {
        signups,
        activeUsers,
        likes,
        matches,
        messages,
        reports,
        callAttempts,
      },
    };
  }
}

function resolveWindowStart(window: "24h" | "7d" | "30d"): Date {
  const now = Date.now();
  const durationMs =
    window === "24h"
      ? 24 * 60 * 60 * 1000
      : window === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
  return new Date(now - durationMs);
}

