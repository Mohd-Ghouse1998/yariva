import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { EVENT_FRESHNESS_MS, invalidEvent } from "./events.policy";

export type PilotWindow = "24h" | "7d" | "30d";
type SupplyRow = { locality: string | null; isTotal: number; total: number; eligible: number; publishedUpcoming: number; publishedNotEnded: number; staleUpcoming: number; cancelled: number };
const MAX_LOCALITIES = 100;

/** Admin-only aggregates. Never returns saves, attendee identities or coordinates. */
@Injectable()
export class EventsReportingService {
  constructor(private readonly prisma: PrismaService) {}
  async summary(cityInput: string, window: PilotWindow = "7d") {
    const city = cityInput.trim();
    if (!city) invalidEvent("Choose a city");
    const now = new Date(), since = new Date(now.getTime() - ({ "24h": 1, "7d": 7, "30d": 30 }[window]) * 86400000);
    const fresh = new Date(now.getTime() - EVENT_FRESHNESS_MS);
    return this.prisma.$transaction(async tx => {
      const supply = await tx.$queryRaw<SupplyRow[]>(Prisma.sql`
        SELECT locality, GROUPING(locality)::integer AS "isTotal", COUNT(*)::integer AS total,
          COUNT(*) FILTER (WHERE status = 'PUBLISHED' AND "startsAt" > ${now} AND "verifiedAt" BETWEEN ${fresh} AND ${now})::integer AS eligible,
          COUNT(*) FILTER (WHERE status = 'PUBLISHED' AND "startsAt" > ${now})::integer AS "publishedUpcoming",
          COUNT(*) FILTER (WHERE status = 'PUBLISHED' AND "endsAt" > ${now})::integer AS "publishedNotEnded",
          COUNT(*) FILTER (WHERE status = 'PUBLISHED' AND "startsAt" > ${now} AND NOT ("verifiedAt" BETWEEN ${fresh} AND ${now}))::integer AS "staleUpcoming",
          COUNT(*) FILTER (WHERE status = 'CANCELLED' AND "endsAt" > ${now})::integer AS cancelled
        FROM "EventListing" WHERE LOWER(city) = LOWER(${city})
        GROUP BY GROUPING SETS ((locality), ()) ORDER BY "isTotal" DESC, locality ASC LIMIT ${MAX_LOCALITIES + 2}
      `);
      const rows = await tx.$queryRaw<{ invitations: number; acceptedEver: number; confirmedUpcomingCurrentVersion: number }[]>(Prisma.sql`
        SELECT COUNT(*)::integer AS invitations,
          COUNT(*) FILTER (WHERE p."acceptedAt" IS NOT NULL)::integer AS "acceptedEver",
          COUNT(*) FILTER (WHERE p.status = 'ACCEPTED' AND p."eventVersion" = e.version AND e.status = 'PUBLISHED'
            AND e."startsAt" > ${now} AND e."verifiedAt" BETWEEN ${fresh} AND ${now})::integer AS "confirmedUpcomingCurrentVersion"
        FROM "DatePlan" p JOIN "EventListing" e ON e.id = p."eventId"
        WHERE LOWER(e.city) = LOWER(${city}) AND p."createdAt" BETWEEN
          (${since}::timestamptz AT TIME ZONE 'UTC') AND (${now}::timestamptz AT TIME ZONE 'UTC')
      `);
      const reports = await tx.report.groupBy({ by: ["reasonCode", "status"], where: {
        targetType: "EVENT_LISTING", targetEvent: { city: { equals: city, mode: "insensitive" } }, createdAt: { gte: since, lte: now },
      }, _count: { _all: true } });
      const totals = supply.find(row => row.isTotal === 1)!;
      const plans = rows[0]!;
      const localities = supply.filter(row => !row.isTotal);
      const reasons = new Map<string, number>();
      for (const row of reports) reasons.set(row.reasonCode, (reasons.get(row.reasonCode) ?? 0) + row._count._all);
      return { city, window, from: since.toISOString(), asOf: now.toISOString(),
        catalog: { total: totals.total, eligibleUpcoming: totals.eligible, publishedUpcoming: totals.publishedUpcoming,
          staleUpcoming: totals.staleUpcoming, cancelledNotEnded: totals.cancelled,
          staleRate: totals.publishedUpcoming ? totals.staleUpcoming / totals.publishedUpcoming : null,
          publishedNotEnded: totals.publishedNotEnded,
          cancellationRate: cancellationRate(totals),
          byLocality: localities.slice(0, MAX_LOCALITIES).map(row => ({ locality: row.locality, total: row.total, eligibleUpcoming: row.eligible,
            publishedUpcoming: row.publishedUpcoming, staleUpcoming: row.staleUpcoming, cancelledNotEnded: row.cancelled, publishedNotEnded: row.publishedNotEnded,
            staleRate: row.publishedUpcoming ? row.staleUpcoming / row.publishedUpcoming : null, cancellationRate: cancellationRate(row) })),
          localitiesTruncated: localities.length > MAX_LOCALITIES },
        plans: { ...plans, acceptanceRate: plans.invitations ? plans.acceptedEver / plans.invitations : null },
        reports: { total: reports.reduce((count, row) => count + row._count._all, 0),
          open: reports.filter(row => ["OPEN", "UNDER_REVIEW"].includes(row.status)).reduce((count, row) => count + row._count._all, 0),
          byReason: [...reasons].sort(([a], [b]) => a.localeCompare(b)).map(([reason, count]) => ({ reason, count })) } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}

// Drafts/archived/ended listings cannot dilute cancellation rates. These are
// current catalog observations; invitation/report windows are separate.
function cancellationRate(row: Pick<SupplyRow, "publishedNotEnded" | "cancelled">): number | null {
  const denominator = row.publishedNotEnded + row.cancelled;
  return denominator ? row.cancelled / denominator : null;
}
