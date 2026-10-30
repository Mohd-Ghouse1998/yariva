import { isUUID } from "class-validator";
import { isActiveAdult } from "./events.policy";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../database/prisma/prisma.transaction";
import { Prisma, type EventListing, type Notification } from "../../generated/prisma/client";
import { mediaPairKey } from "../../integrations/object-storage/media-disclosure.service";
import { NotificationIntentService } from "../notifications/application/notification-intent.service";

const PLAN_PAGE_SIZE = 50;
const RECOVERY_PAGES_PER_TICK = 10;

/** Atomic curation outbox + bounded worker fan-out. A crash cannot lose the change. */
@Injectable()
export class EventNoticesService {
  constructor(private readonly prisma: PrismaService, private readonly intents: NotificationIntentService) {}

  async persistChange(tx: PrismaTransactionalClient, event: EventListing) {
    await tx.eventChangeNotice.create({ data: { eventId: event.id, eventVersion: event.version, status: event.status } });
  }

  // Called by the existing recurring notification recovery job. Rows and cursors
  // commit with their notification intents, so retries cannot skip or duplicate.
  async reconcile(): Promise<void> {
    for (let page = 0; page < RECOVERY_PAGES_PER_TICK; page++) {
      const result = await this.prisma.$transaction(async tx => {
        const locks = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "EventChangeNotice" WHERE "completedAt" IS NULL
          ORDER BY "createdAt", id FOR UPDATE SKIP LOCKED LIMIT 1`;
        if (!locks[0]) return null;
        const change = await tx.eventChangeNotice.findUniqueOrThrow({ where: { id: locks[0].id } });
        await tx.$queryRaw`SELECT id FROM "EventListing" WHERE id = ${change.eventId}::uuid FOR UPDATE`;
        const event = await tx.eventListing.findUnique({ where: { id: change.eventId } });
        if (!event || event.version !== change.eventVersion) {
          await tx.eventChangeNotice.update({ where: { id: change.id }, data: { completedAt: new Date() } });
          return [];
        }
        const candidates = await tx.$queryRaw<{ id: string; matchId: string; userLowId: string; userHighId: string }[]>(Prisma.sql`
          SELECT p.id, p."matchId", m."userLowId", m."userHighId" FROM "DatePlan" p JOIN "Match" m ON m.id = p."matchId"
          WHERE p."eventId" = ${change.eventId}::uuid AND p."eventVersion" < ${change.eventVersion}
            AND p."createdAt" <= (${change.createdAt}::timestamptz AT TIME ZONE 'UTC') AND p.status IN ('PROPOSED','COUNTERED','ACCEPTED')
            AND p."proposedStartAt" + p."durationMinutes" * interval '1 minute' > (${change.createdAt}::timestamptz AT TIME ZONE 'UTC')
            AND (${change.afterPlanId}::uuid IS NULL OR p.id > ${change.afterPlanId}::uuid)
          ORDER BY p.id LIMIT ${PLAN_PAGE_SIZE}
        `);
        const afterPlanId = candidates.at(-1)?.id;
        // Relationship locks use the same ordering as blocks and date-plan writes.
        // Globally sort pairs so two fan-out pages cannot acquire them in reverse.
        const ordered = [...candidates].sort((a, b) => mediaPairKey(a.userLowId, a.userHighId).localeCompare(mediaPairKey(b.userLowId, b.userHighId)));
        const notices: { notification: Notification; created: boolean }[] = [];
        for (const plan of ordered) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${mediaPairKey(plan.userLowId, plan.userHighId)}, 0))`;
          await tx.$queryRaw`SELECT id FROM "Match" WHERE id = ${plan.matchId}::uuid FOR UPDATE`;
          const data = { route: "event-plan-change", eventId: change.eventId, eventVersion: change.eventVersion, datePlanId: plan.id };
          for (const userId of [plan.userLowId, plan.userHighId]) {
            if (!await canReadEventPlanNotice(tx, { userId, data })) continue;
            notices.push(await this.intents.persist(tx, {
              userId, actorUserId: null, type: change.status === "PUBLISHED" ? "DATE_CHANGED" : "DATE_CANCELLED",
              title: change.status === "PUBLISHED" ? "An event in your plan changed" : "An event in your plan is unavailable",
              body: "Open your plan to review the latest details before meeting.", data,
              dedupeKey: `event-change:${change.eventId}:${change.eventVersion}:${plan.id}:${userId}`,
            }));
          }
        }
        await tx.eventChangeNotice.update({ where: { id: change.id }, data: {
          ...(afterPlanId ? { afterPlanId } : {}), ...(candidates.length < PLAN_PAGE_SIZE ? { completedAt: new Date() } : {}),
        } });
        return notices;
      }, { timeout: 15000 });
      if (result === null) return;
      for (const notice of result) {
        if (await canReadEventPlanNotice(this.prisma, notice.notification)) await this.intents.dispatchPersisted(notice);
      }
    }
  }
}

/** Shared by creation, inbox/read, recovery and every push-device send. */
export async function canReadEventPlanNotice(db: PrismaTransactionalClient, notice: { userId: string; data?: unknown }): Promise<boolean> {
  const data = notice.data;
  if (!data || typeof data !== "object" || !("datePlanId" in data) || typeof data.datePlanId !== "string" || !isUUID(data.datePlanId) ||
    !("eventId" in data) || typeof data.eventId !== "string" || !isUUID(data.eventId) || !("eventVersion" in data) || typeof data.eventVersion !== "number" || !Number.isInteger(data.eventVersion) || data.eventVersion < 1) return false;
  const plan = await db.datePlan.findUnique({ where: { id: data.datePlanId }, select: {
    status: true, eventId: true, eventVersion: true, event: { select: { version: true } },
    match: { select: { status: true, userLowId: true, userHighId: true,
      userLow: { select: { status: true, deletedAt: true, profile: { select: { dateOfBirth: true } } } },
      userHigh: { select: { status: true, deletedAt: true, profile: { select: { dateOfBirth: true } } } } } },
  } });
  if (!plan || !["PROPOSED", "COUNTERED", "ACCEPTED"].includes(plan.status) || plan.eventId !== data.eventId ||
    plan.event?.version !== data.eventVersion || plan.eventVersion === null || plan.eventVersion >= data.eventVersion || plan.match.status !== "ACTIVE") return false;
  const { userLowId, userHighId, userLow, userHigh } = plan.match;
  if (![userLowId, userHighId].includes(notice.userId) || [userLow, userHigh].some(user => !isActiveAdult(user))) return false;
  return !await db.block.findFirst({ where: { deletedAt: null, OR: [{ blockerId: userLowId, blockedId: userHighId }, { blockerId: userHighId, blockedId: userLowId }] }, select: { id: true } });
}
