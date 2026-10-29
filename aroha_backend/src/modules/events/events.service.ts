import { Injectable } from "@nestjs/common";
import { isUUID } from "class-validator";
import { ERROR_CODES } from "../../common/constants/error-codes";
import { AppException } from "../../common/errors/app.exception";
import { AuditLogService } from "../../common/services/audit-log.service";
import type { AuthContext } from "../../common/types/auth-context.type";
import { PrismaService } from "../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../database/prisma/prisma.transaction";
import { Prisma, type EventListing } from "../../generated/prisma/client";
import { EvaluateFeatureFlagService } from "../feature-flags/application/feature-flags.services";
import type { AdminEventQueryDto, CurateEventDto, EventQueryDto } from "./events.dto";
import { curateEventData, EVENT_FRESHNESS_MS, eventUnavailable, invalidEvent } from "./events.policy";

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService, private readonly flags: EvaluateFeatureFlagService, private readonly audit: AuditLogService) {}

  async status(userId: string) {
    const result = await this.flags.execute({ key: "events.v1", userId });
    if (result.enabled) {
      try { await this.assertEligible(userId); }
      catch (error) {
        if (error instanceof AppException && error.getStatus() === 403) return { enabled: false };
        throw error;
      }
    }
    return { enabled: result.enabled };
  }

  async assertEnabled(userId: string) {
    if (!(await this.status(userId)).enabled) throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Events are not available");
  }

  async assertEligible(userId: string, tx: PrismaTransactionalClient = this.prisma) {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true, deletedAt: true, profile: { select: { dateOfBirth: true } } } });
    const dob = user?.profile?.dateOfBirth, now = new Date();
    const age = dob ? now.getUTCFullYear() - dob.getUTCFullYear() - Number(now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())) : 0;
    if (!user || user.status !== "ACTIVE" || user.deletedAt || age < 18) throw new AppException(403, ERROR_CODES.FORBIDDEN, "Events require an active adult profile");
  }

  async list(userId: string, query: EventQueryDto) {
    await this.assertEnabled(userId);
    const now = new Date(), savedOnly = query.saved === "true";
    const from = query.from ? new Date(query.from) : now;
    const until = query.until ? new Date(query.until) : undefined;
    if (until && until <= from) invalidEvent("The end of the date range must follow the start");
    const after = query.cursor ? decodeCursor(query.cursor) : null;
    const where: Prisma.EventListingWhereInput = {
      city: { equals: query.city.trim(), mode: "insensitive" },
      ...(query.area?.trim() ? { locality: { contains: query.area.trim(), mode: "insensitive" } } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(savedOnly ? {
        saves: { some: { userId } }, status: { in: ["PUBLISHED", "CANCELLED"] },
        ...((query.from || until) ? { startsAt: { ...(query.from ? { gte: from } : {}), ...(until ? { lt: until } : {}) } } : {}),
      } : {
        status: "PUBLISHED", startsAt: { gt: now, gte: from, ...(until ? { lt: until } : {}) },
        verifiedAt: { gte: new Date(now.getTime() - EVENT_FRESHNESS_MS), lte: now },
      }),
      ...(query.maxPricePaise !== undefined ? { priceMaxPaise: { lte: query.maxPricePaise } } : {}),
      ...(after ? { OR: [{ startsAt: { gt: after.startsAt } }, { startsAt: after.startsAt, id: { gt: after.id } }] } : {}),
    };
    const limit = query.limit ?? 20;
    const rows = await this.prisma.eventListing.findMany({ where, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: limit + 1, include: { saves: { where: { userId }, select: { userId: true } } } });
    const items = rows.slice(0, limit), last = items.at(-1);
    return { items: items.map((row) => mapEvent(row, row.saves.length > 0)), nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ startsAt: last.startsAt.toISOString(), id: last.id })).toString("base64url") : null };
  }

  async get(userId: string, eventId: string) {
    await this.assertEnabled(userId);
    const row = await this.prisma.eventListing.findUnique({ where: { id: eventId }, include: { saves: { where: { userId }, select: { userId: true } } } });
    if (!row || !["PUBLISHED", "CANCELLED"].includes(row.status) || (eventUnavailable(row) && row.saves.length === 0)) throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Event is no longer available");
    return { event: mapEvent(row, row.saves.length > 0) };
  }

  async save(userId: string, eventId: string) {
    await this.assertEnabled(userId);
    return this.prisma.$transaction(async (tx) => {
      const event = await this.lockAvailable(eventId, undefined, tx);
      await tx.savedEvent.upsert({ where: { userId_eventId: { userId, eventId } }, create: { userId, eventId }, update: {} });
      return { event: mapEvent(event, true) };
    });
  }

  async unsave(userId: string, eventId: string) {
    await this.assertEnabled(userId);
    // Idempotent and owner-scoped. There is deliberately no public saves API.
    await this.prisma.savedEvent.deleteMany({ where: { userId, eventId } });
    return { saved: false };
  }

  async lockAvailable(eventId: string, version: number | undefined, tx: PrismaTransactionalClient) {
    await tx.$queryRaw`SELECT id FROM "EventListing" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const event = await tx.eventListing.findUnique({ where: { id: eventId } });
    if (!event || eventUnavailable(event)) throw new AppException(409, ERROR_CODES.CONFLICT, "This event is no longer available. Choose another event.");
    if (version !== undefined && event.version !== version) throw new AppException(409, ERROR_CODES.CONFLICT, "Event details changed. Review the latest listing and send a new invitation.");
    return event;
  }

  async proposal(eventId: string, version: number, userId: string) {
    await this.assertEnabled(userId);
    const event = await this.prisma.eventListing.findUnique({ where: { id: eventId } });
    if (!event || eventUnavailable(event) || event.version !== version) throw new AppException(409, ERROR_CODES.CONFLICT, "Review the latest event before inviting someone");
    return event;
  }

  async assertMatchEligible(matchId: string, userId: string, tx: PrismaTransactionalClient) {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match || match.status !== "ACTIVE" || ![match.userLowId, match.userHighId].includes(userId)) throw new AppException(403, ERROR_CODES.MATCH_NOT_ACTIVE, "An active match is required to invite someone");
    await this.assertEligible(match.userLowId, tx);
    await this.assertEligible(match.userHighId, tx);
    const block = await tx.block.findFirst({ where: { deletedAt: null, OR: [{ blockerId: match.userLowId, blockedId: match.userHighId }, { blockerId: match.userHighId, blockedId: match.userLowId }] } });
    if (block) throw new AppException(403, ERROR_CODES.FORBIDDEN, "This connection is unavailable");
  }

  async curate(actor: AuthContext, id: string, payload: CurateEventDto) {
    const data = curateEventData(payload);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "EventListing" WHERE id = ${id}::uuid FOR UPDATE`;
        const existing = await tx.eventListing.findUnique({ where: { id } });
        if ((existing?.version ?? 0) !== payload.expectedVersion) throw new AppException(409, ERROR_CODES.CONFLICT, "Listing changed; reload before editing");
        const event = existing
          ? await tx.eventListing.update({ where: { id }, data: { ...data, version: { increment: 1 } } })
          : await tx.eventListing.create({ data: { ...data, id } });
        await this.audit.write({ actorUserId: actor.user.id, actorSessionId: actor.session.id, action: "event.curate", entityType: "EventListing", entityId: id, metadata: { version: event.version, status: event.status } }, tx);
        return { event: mapEvent(event, false) };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppException(409, ERROR_CODES.CONFLICT, "An event with this source or schedule already exists");
      throw error;
    }
  }

  async adminList(query: AdminEventQueryDto) {
    const rows = await this.prisma.eventListing.findMany({
      where: { city: { equals: query.city.trim(), mode: "insensitive" } },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }], take: query.limit ?? 20,
    });
    return { items: rows.map((row) => ({ ...mapEvent(row, false), imageRights: row.imageRights })) };
  }

  async adminGet(id: string) {
    const event = await this.prisma.eventListing.findUnique({ where: { id } });
    if (!event) throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Event not found");
    return { event: { ...mapEvent(event, false), imageRights: event.imageRights } };
  }
}

export function mapEvent(event: EventListing, saved: boolean) {
  return {
    id: event.id, version: event.version, status: event.status, title: event.title, description: event.description,
    category: event.category, city: event.city, locality: event.locality, venueName: event.venueName, venueAddress: event.venueAddress,
    startsAt: event.startsAt.toISOString(), endsAt: event.endsAt.toISOString(), timezone: event.timezone,
    priceMinPaise: event.priceMinPaise, priceMaxPaise: event.priceMaxPaise, currency: event.currency,
    sourceUrl: event.sourceUrl, sourceName: event.sourceName, bookingUrl: event.bookingUrl,
    imageUrl: event.imageUrl, verifiedAt: event.verifiedAt.toISOString(), saved, unavailable: eventUnavailable(event),
  };
}

function decodeCursor(value: string): { startsAt: Date; id: string } {
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString()) as { startsAt: string; id: string };
    if (!isUUID(decoded.id) || typeof decoded.startsAt !== "string" || !Number.isFinite(Date.parse(decoded.startsAt))) throw new Error();
    return { startsAt: new Date(decoded.startsAt), id: decoded.id };
  } catch { throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid events cursor"); }
}
