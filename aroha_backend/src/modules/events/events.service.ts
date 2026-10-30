import { EventNoticesService } from "./event-notices.service";
import { encodeScopedCursor, decodeScopedCursor } from "../../common/utils/scoped-cursor.util";
import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import planningConfig from "../../config/planning.config";
import { ReviewedVenuesService } from "../date-plans/application/reviewed-venues.service";
import { isUUID } from "class-validator";
import { ERROR_CODES } from "../../common/constants/error-codes";
import { AppException } from "../../common/errors/app.exception";
import { AuditLogService } from "../../common/services/audit-log.service";
import type { AuthContext } from "../../common/types/auth-context.type";
import { PrismaService } from "../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../database/prisma/prisma.transaction";
import { Prisma, type EventListing } from "../../generated/prisma/client";
import { EvaluateFeatureFlagService } from "../feature-flags/application/feature-flags.services";
import type {
  AdminEventQueryDto,
  CurateEventDto,
  EventQueryDto,
} from "./events.dto";
import {
  curateEventData,
  EVENT_FRESHNESS_MS,
  eventUnavailable,
  invalidEvent,
  isActiveAdult,
} from "./events.policy";

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: EvaluateFeatureFlagService,
    private readonly audit: AuditLogService,
    private readonly venues: ReviewedVenuesService,
    private readonly notices: EventNoticesService,
    @Inject(planningConfig.KEY)
    private readonly planning: ConfigType<typeof planningConfig>,
  ) {}

  async status(userId: string) {
    const result = await this.flags.execute({ key: "events.v1", userId });
    if (result.enabled) {
      try {
        await this.assertEligible(userId);
      } catch (error) {
        if (error instanceof AppException && error.getStatus() === 403)
          return { enabled: false };
        throw error;
      }
    }
    return { enabled: result.enabled };
  }

  async assertEnabled(userId: string) {
    if (!(await this.status(userId)).enabled)
      throw new AppException(
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "Events are not available",
      );
  }

  async assertEligible(
    userId: string,
    tx: PrismaTransactionalClient = this.prisma,
  ) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        deletedAt: true,
        profile: { select: { dateOfBirth: true } },
      },
    });
    if (!user || !isActiveAdult(user))
      throw new AppException(
        403,
        ERROR_CODES.FORBIDDEN,
        "Events require an active adult profile",
      );
  }

  async list(userId: string, query: EventQueryDto) {
    await this.assertEnabled(userId);
    const now = new Date(),
      savedOnly = query.saved === "true";
    const from = query.from ? new Date(query.from) : now;
    const until = query.until ? new Date(query.until) : undefined;
    if (until && until <= from)
      invalidEvent("The end of the date range must follow the start");
    if ((query.latitude == null) !== (query.longitude == null))
      invalidEvent(
        "Provide both location coordinates, or choose a city manually",
      );
    if (!query.city.trim()) invalidEvent("Choose a city");
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ ...query, cursor: undefined }))
      .digest("hex");
    const after = query.cursor ? decodeCursor(query.cursor, fingerprint) : null;
    const latitude = query.latitude ?? null,
      longitude = query.longitude ?? null;
    const limit = query.limit ?? 20;
    const { rows, events } = await this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string; startsAt: Date; distanceMeters: number }[]
        >(Prisma.sql`
      WITH candidates AS (
        SELECT e."id", e."startsAt", CASE WHEN ${latitude}::double precision IS NULL THEN 0 ELSE
          ST_Distance(e."locationPoint", ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}),4326)::geography)
          END AS "distanceMeters"
        FROM "EventListing" e
        WHERE LOWER(e."city") = LOWER(${query.city.trim()})
          AND (${query.area?.trim() ?? ""} = '' OR POSITION(LOWER(${query.area?.trim() ?? ""}) IN LOWER(e."locality")) > 0)
          AND (${query.category ?? null}::text IS NULL OR e."category"::text = ${query.category ?? null})
          AND (${query.maxPricePaise ?? null}::integer IS NULL OR (e."currency" = 'INR' AND e."priceMaxPaise" <= ${query.maxPricePaise ?? null}))
          AND (${latitude}::double precision IS NULL OR ST_DWithin(e."locationPoint",
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}),4326)::geography, ${this.planning.venueRadiusMeters}))
          AND ${
            savedOnly
              ? Prisma.sql`
            e."status" IN ('PUBLISHED', 'CANCELLED')
            AND EXISTS(SELECT 1 FROM "SavedEvent" s WHERE s."eventId" = e.id AND s."userId" = ${userId}::uuid)
            AND (${query.from ? from : null}::timestamptz IS NULL OR e."startsAt" >= ${query.from ? from : null})
            AND (${until ?? null}::timestamptz IS NULL OR e."startsAt" < ${until ?? null})
          `
              : Prisma.sql`
            e."status" = 'PUBLISHED' AND e."startsAt" > ${now} AND e."startsAt" >= ${from}
            AND (${until ?? null}::timestamptz IS NULL OR e."startsAt" < ${until ?? null})
            AND e."verifiedAt" BETWEEN ${new Date(now.getTime() - EVENT_FRESHNESS_MS)} AND ${now}
          `
          }
      ) SELECT * FROM candidates
      WHERE ${after ? Prisma.sql`("distanceMeters", "startsAt", id) > (${after.distanceMeters}, ${after.startsAt}, ${after.id}::uuid)` : Prisma.sql`TRUE`}
      ORDER BY "distanceMeters", "startsAt", id LIMIT ${limit + 1}
    `);
        const events = await tx.eventListing.findMany({
          where: { id: { in: rows.slice(0, limit).map((row) => row.id) } },
          include: { saves: { where: { userId }, select: { userId: true } } },
        });
        return { rows, events };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const selected = rows.slice(0, limit),
      last = selected.at(-1);
    const byId = new Map(events.map((event) => [event.id, event]));
    const items = selected.flatMap((row) => {
      const event = byId.get(row.id);
      // Selection and transport rows share a database snapshot; writes reauthorize under locks.
      if (
        !event ||
        (savedOnly
          ? !["PUBLISHED", "CANCELLED"].includes(event.status)
          : eventUnavailable(event))
      )
        return [];
      return [
        {
          ...mapEvent(event, event.saves.length > 0),
          distanceKm:
            latitude === null
              ? null
              : Math.round(row.distanceMeters / 100) / 10,
        },
      ];
    });
    // A fallback is part of a successful first discovery result, never a catch path
    // or a terminal pagination/Saved page. Do not broaden unsupported filters.
    let placesStatus: "MATCHES" | "EMPTY" | "UNSUPPORTED_FILTERS" | null = null;
    let places: Awaited<ReturnType<ReviewedVenuesService["search"]>>["items"] =
      [];
    if (!savedOnly && !query.cursor && rows.length === 0) {
      if (
        query.from ||
        query.until ||
        (query.category && query.category !== "FOOD")
      )
        placesStatus = "UNSUPPORTED_FILTERS";
      else {
        const result = await this.venues.search(
          {
            locationMode: latitude === null ? "AREA" : "ME",
            area: query.city.trim(),
          },
          latitude === null ? null : { latitude, longitude: longitude! },
          {
            city: query.city.trim(),
            area: query.area?.trim(),
            maxPricePaise: query.maxPricePaise,
            realOnly: true,
          },
        );
        places = result.items;
        placesStatus = places.length ? "MATCHES" : "EMPTY";
      }
    }
    return {
      items,
      places,
      placesStatus,
      nextCursor:
        rows.length > limit && last
          ? Buffer.from(
              JSON.stringify({
                startsAt: last.startsAt.toISOString(),
                id: last.id,
                distanceMeters: last.distanceMeters,
                fingerprint,
              }),
            ).toString("base64url")
          : null,
    };
  }

  async place(userId: string, id: string) {
    await this.assertEnabled(userId);
    const result = await this.venues.search({ locationMode: "AREA" }, null, {
      id,
      realOnly: true,
    });
    if (!result.items[0])
      throw new AppException(
        404,
        ERROR_CODES.VENUE_NOT_FOUND,
        "This reviewed place is no longer available",
      );
    return { place: result.items[0] };
  }

  async get(userId: string, eventId: string) {
    await this.assertEnabled(userId);
    const row = await this.prisma.eventListing.findUnique({
      where: { id: eventId },
      include: { saves: { where: { userId }, select: { userId: true } } },
    });
    const participant =
      row && eventUnavailable(row) && row.saves.length === 0
        ? await this.prisma.datePlan.findFirst({
            where: {
              eventId,
              match: { OR: [{ userLowId: userId }, { userHighId: userId }] },
            },
            select: { id: true },
          })
        : null;
    if (
      !row ||
      !["PUBLISHED", "CANCELLED"].includes(row.status) ||
      (eventUnavailable(row) && row.saves.length === 0 && !participant)
    )
      throw new AppException(
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "Event is no longer available",
      );
    return { event: mapEvent(row, row.saves.length > 0) };
  }

  async save(userId: string, eventId: string) {
    await this.assertEnabled(userId);
    return this.prisma.$transaction(async (tx) => {
      const event = await this.lockAvailable(eventId, undefined, tx);
      await tx.savedEvent.upsert({
        where: { userId_eventId: { userId, eventId } },
        create: { userId, eventId },
        update: {},
      });
      return { event: mapEvent(event, true) };
    });
  }

  async unsave(userId: string, eventId: string) {
    await this.assertEnabled(userId);
    // Idempotent and owner-scoped. There is deliberately no public saves API.
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "EventListing" WHERE id = ${eventId}::uuid FOR UPDATE`;
      await tx.savedEvent.deleteMany({ where: { userId, eventId } });
    });
    return { saved: false };
  }

  async lockAvailable(
    eventId: string,
    version: number | undefined,
    tx: PrismaTransactionalClient,
  ) {
    await tx.$queryRaw`SELECT id FROM "EventListing" WHERE id = ${eventId}::uuid FOR UPDATE`;
    const event = await tx.eventListing.findUnique({ where: { id: eventId } });
    if (!event || eventUnavailable(event))
      throw new AppException(
        409,
        ERROR_CODES.CONFLICT,
        "This event is no longer available. Choose another event.",
      );
    if (version !== undefined && event.version !== version)
      throw new AppException(
        409,
        ERROR_CODES.CONFLICT,
        "Event details changed. Review the latest listing and send a new invitation.",
      );
    return event;
  }

  async proposal(eventId: string, version: number, userId: string) {
    await this.assertEnabled(userId);
    const event = await this.prisma.eventListing.findUnique({
      where: { id: eventId },
    });
    if (!event || eventUnavailable(event) || event.version !== version)
      throw new AppException(
        409,
        ERROR_CODES.CONFLICT,
        "Review the latest event before inviting someone",
      );
    return event;
  }

  async assertMatchEligible(
    matchId: string,
    userId: string,
    tx: PrismaTransactionalClient,
  ) {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (
      !match ||
      match.status !== "ACTIVE" ||
      ![match.userLowId, match.userHighId].includes(userId)
    )
      throw new AppException(
        403,
        ERROR_CODES.MATCH_NOT_ACTIVE,
        "An active match is required to invite someone",
      );
    await this.assertEligible(match.userLowId, tx);
    await this.assertEligible(match.userHighId, tx);
    const block = await tx.block.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { blockerId: match.userLowId, blockedId: match.userHighId },
          { blockerId: match.userHighId, blockedId: match.userLowId },
        ],
      },
    });
    if (block)
      throw new AppException(
        403,
        ERROR_CODES.FORBIDDEN,
        "This connection is unavailable",
      );
  }

  async curate(actor: AuthContext, id: string, payload: CurateEventDto) {
    const data = curateEventData(payload);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "EventListing" WHERE id = ${id}::uuid FOR UPDATE`;
        const existing = await tx.eventListing.findUnique({ where: { id } });
        if ((existing?.version ?? 0) !== payload.expectedVersion)
          throw new AppException(
            409,
            ERROR_CODES.CONFLICT,
            "Listing changed; reload before editing",
          );
        const event = existing
          ? await tx.eventListing.update({
              where: { id },
              data: { ...data, version: { increment: 1 } },
            })
          : await tx.eventListing.create({ data: { ...data, id } });
        if (existing) await this.notices.persistChange(tx, event);
        await this.audit.write(
          {
            actorUserId: actor.user.id,
            actorSessionId: actor.session.id,
            action: "event.curate",
            entityType: "EventListing",
            entityId: id,
            metadata: { version: event.version, status: event.status },
          },
          tx,
        );
        return { event: mapEvent(event, false) };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new AppException(
          409,
          ERROR_CODES.CONFLICT,
          "An event with this source or schedule already exists",
        );
      throw error;
    }
  }

  async adminList(query: AdminEventQueryDto) {
    const city = query.city.trim();
    if (!city) invalidEvent("Choose a city");
    const scope = `admin-events:${city.toLowerCase()}`;
    const after = query.cursor ? decodeScopedCursor(query.cursor, scope) : null;
    const limit = query.limit ?? 20;
    const rows = await this.prisma.eventListing.findMany({
      where: { city: { equals: city, mode: "insensitive" },
        ...(after ? { OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }] } : {}) },
      // Creation order stays stable when curators change the event's schedule.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1,
    });
    const items = rows.slice(0, limit), last = items.at(-1);
    return { items: items.map(row => ({ ...mapEvent(row, false), createdAt: row.createdAt.toISOString(),
      imageRights: row.imageRights, latitude: row.latitude == null ? null : Number(row.latitude), longitude: row.longitude == null ? null : Number(row.longitude) })),
      nextCursor: rows.length > limit && last ? encodeScopedCursor(last, scope) : null };
  }

  async adminGet(id: string) {
    const event = await this.prisma.eventListing.findUnique({ where: { id } });
    if (!event)
      throw new AppException(
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "Event not found",
      );
    return {
      event: {
        ...mapEvent(event, false),
        imageRights: event.imageRights,
        latitude: event.latitude == null ? null : Number(event.latitude),
        longitude: event.longitude == null ? null : Number(event.longitude),
      },
    };
  }
}

export function mapEvent(event: EventListing, saved: boolean) {
  return {
    id: event.id,
    version: event.version,
    status: event.status,
    title: event.title,
    description: event.description,
    category: event.category,
    city: event.city,
    locality: event.locality,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    timezone: event.timezone,
    priceMinPaise: event.priceMinPaise,
    priceMaxPaise: event.priceMaxPaise,
    currency: event.currency,
    sourceUrl: event.sourceUrl,
    sourceName: event.sourceName,
    bookingUrl: event.bookingUrl,
    availableUntil: new Date(Math.min(event.startsAt.getTime(), event.verifiedAt.getTime() + EVENT_FRESHNESS_MS)).toISOString(),
    serverNow: new Date().toISOString(),
    imageUrl: event.imageUrl,
    verifiedAt: event.verifiedAt.toISOString(),
    saved,
    unavailable: eventUnavailable(event),
  };
}

function decodeCursor(
  value: string,
  fingerprint: string,
): { startsAt: Date; id: string; distanceMeters: number } {
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString()) as {
      startsAt: string;
      id: string;
      distanceMeters: number;
      fingerprint: string;
    };
    if (
      !isUUID(decoded.id) ||
      typeof decoded.startsAt !== "string" ||
      !Number.isFinite(Date.parse(decoded.startsAt)) ||
      !Number.isFinite(decoded.distanceMeters) ||
      decoded.distanceMeters < 0 ||
      decoded.fingerprint !== fingerprint
    )
      throw new Error();
    return {
      startsAt: new Date(decoded.startsAt),
      id: decoded.id,
      distanceMeters: decoded.distanceMeters,
    };
  } catch {
    throw new AppException(
      400,
      ERROR_CODES.INVALID_CURSOR,
      "Invalid events cursor; refresh this search",
    );
  }
}
