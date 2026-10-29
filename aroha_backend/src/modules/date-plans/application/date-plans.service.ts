import { mediaPairKey } from "../../../integrations/object-storage/media-disclosure.service";
import { EventsService } from "../../events/events.service";
import { eventUnavailable } from "../../events/events.policy";
import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AppLogger } from "../../../common/logger/app-logger.service";
import planningConfig from "../../../config/planning.config";
import { AuditLogService } from "../../../common/services/audit-log.service";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import { Prisma, type ReviewedVenue } from "../../../generated/prisma/client";
import { BullmqProducer } from "../../../integrations/bullmq/bullmq.producer";
import { AnalyticsEventWriterService } from "../../analytics/application/analytics.services";
import { CreateNotificationService } from "../../notifications/application/notifications.services";
import { DatePlanPolicy } from "../domain/date-plans.policy";
import { resolveMutualMeetAgain } from "../domain/date-plans.privacy";
import { calculateMidpoint } from "../domain/venue-geography";
import type {
  CounterDatePlanDto,
  CreateDatePlanDto,
  DatePlanCheckInDto,
  DatePlanDto,
  DatePlanPageDto,
  DatePlanResponseDto,
  VenueSearchQueryDto,
  VenueCategoryValue,
  VenueSuggestionDto,
  VenueSuggestionsResponseDto,
  PostDateResponseDto,
} from "../dto/date-plans.dto";
import {
  DATE_PLAN_INCLUDE,
  DatePlansRepository,
  type DatePlanRecord,
} from "../infrastructure/date-plans.repository";

@Injectable()
export class DatePlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: DatePlansRepository,
    private readonly policy: DatePlanPolicy,
    private readonly notifications: CreateNotificationService,
    private readonly analytics: AnalyticsEventWriterService,
    private readonly auditLog: AuditLogService,
    private readonly bullmqProducer: BullmqProducer,
    private readonly logger: AppLogger,
    @Inject(planningConfig.KEY)
    private readonly planning: ConfigType<typeof planningConfig>,
    private readonly events: EventsService,
  ) {}

  async venueSuggestions(
    userId: string,
    matchId: string,
    query: VenueSearchQueryDto,
  ): Promise<VenueSuggestionsResponseDto> {
    const match = await this.repository.findMatchContext(matchId);
    this.policy.assertActiveMatch(userId, match);
    if (!this.planning.venueSuggestionsEnabled) {
      return { items: [], manualFallbackAvailable: true };
    }

    const low = match.userLow.profile;
    const high = match.userHigh.profile;
    const locationMode = query.locationMode ?? "MIDPOINT";
    const areaSearch = locationMode === "AREA" ? query.area?.trim().toLocaleLowerCase() ?? "" : "";
    let searchPoint: { latitude: number; longitude: number } | null = null;

    if (locationMode === "ME") {
      const mine = match.userLowId === userId ? low : high;
      if (mine?.locationLat != null && mine.locationLng != null) {
        searchPoint = { latitude: Number(mine.locationLat), longitude: Number(mine.locationLng) };
      }
    } else if (locationMode === "MIDPOINT") {
      if (low?.locationLat != null && low.locationLng != null && high?.locationLat != null && high.locationLng != null) {
        searchPoint = calculateMidpoint(
          { latitude: Number(low.locationLat), longitude: Number(low.locationLng) },
          { latitude: Number(high.locationLat), longitude: Number(high.locationLng) },
        );
      }
    }

    return this.reviewedVenues(query, searchPoint);
  }

  // Relationship authorization stays with the caller; coordinates never leave this service.
  async reviewedVenues(query: VenueSearchQueryDto, searchPoint: { latitude: number; longitude: number } | null): Promise<VenueSuggestionsResponseDto> {
    if (!this.planning.venueSuggestionsEnabled) return { items: [], manualFallbackAvailable: true };
    const locationMode = query.locationMode ?? "MIDPOINT";
    const areaSearch = locationMode === "AREA" ? query.area?.trim().toLocaleLowerCase() ?? "" : "";
    if (locationMode !== "AREA" && !searchPoint) {
      return { items: [], manualFallbackAvailable: true };
    }
    if (locationMode === "AREA" && !areaSearch) {
      return { items: [], manualFallbackAvailable: true };
    }

    const searchText = query.query?.trim().toLocaleLowerCase() ?? "";
    const category = query.category ?? null;
    const centerLatitude = searchPoint?.latitude ?? null;
    const centerLongitude = searchPoint?.longitude ?? null;
    const rows = await this.prisma.$queryRaw<VenueQueryRow[]>(Prisma.sql`
      SELECT
        "id", "name", "photoUrl", "address", "publicLocality", "reviewSource", "reviewedAt",
        "operationalStatus"::text AS "operationalStatus", "category"::text AS "category",
        "priceMaxPerPerson", "rating", "ratingCount", "accessibilityFacts", "atmosphereTags", "isSynthetic",
        CASE
          WHEN ${centerLatitude}::double precision IS NULL THEN NULL
          ELSE ROUND((ST_Distance(
            "locationPoint",
            ST_SetSRID(ST_MakePoint(${centerLongitude}, ${centerLatitude}), 4326)::geography
          ) / 1000.0)::numeric, 1)::double precision
        END AS "distanceKm"
      FROM "ReviewedVenue"
      WHERE "reviewStatus" = 'REVIEWED'::"VenueReviewStatus"
        AND "operationalStatus" <> 'CLOSED'::"VenueOperationalStatus"
        AND "deletedAt" IS NULL
        AND (${category}::text IS NULL OR "category"::text = ${category})
        AND (
          ${searchText} = ''
          OR POSITION(${searchText} IN LOWER("name")) > 0
          OR POSITION(${searchText} IN LOWER("address")) > 0
          OR POSITION(${searchText} IN LOWER("publicLocality")) > 0
        )
        AND (
          ${areaSearch} = ''
          OR POSITION(${areaSearch} IN LOWER("publicLocality")) > 0
          OR POSITION(${areaSearch} IN LOWER("city")) > 0
          OR POSITION(${areaSearch} IN LOWER("address")) > 0
        )
        AND (
          ${centerLatitude}::double precision IS NULL
          OR ST_DWithin(
            "locationPoint",
            ST_SetSRID(ST_MakePoint(${centerLongitude}, ${centerLatitude}), 4326)::geography,
            ${this.planning.venueRadiusMeters}
          )
        )
      ORDER BY "rating" DESC NULLS LAST, "ratingCount" DESC NULLS LAST, "distanceKm" ASC NULLS LAST, "id"
      LIMIT ${this.planning.maxVenueSuggestions}
    `);

    const items = rows
      .map((venue): VenueSuggestionDto => ({
        id: venue.id,
        name: venue.name,
        photoUrl: venue.photoUrl,
        address: venue.address,
        publicLocality: venue.publicLocality,
        reviewLabel: "Venue details reviewed",
        reviewSource: venue.reviewSource,
        reviewedAt: venue.reviewedAt?.toISOString() ?? null,
        availability: venue.operationalStatus === "OPEN" ? "OPEN" : "UNKNOWN",
        category: venue.category,
        priceTier: toPriceTier(venue.priceMaxPerPerson),
        rating: venue.rating == null ? null : Number(venue.rating),
        ratingCount: venue.ratingCount,
        distanceKm: locationMode === "ME" ? venue.distanceKm : null,
        accessibilityFacts: venue.accessibilityFacts,
        atmosphereTags: venue.atmosphereTags,
        isSynthetic: venue.isSynthetic,
      }));
    return { items, manualFallbackAvailable: true };
  }

  async create(input: {
    actor: AuthContext;
    matchId: string;
    payload: CreateDatePlanDto;
  }): Promise<DatePlanResponseDto> {
    const match = await this.repository.findMatchContext(input.matchId);
    this.policy.assertActiveMatch(input.actor.user.id, match);
    if (Boolean(input.payload.eventId) !== Boolean(input.payload.eventVersion)) {
      throw new AppException(400, ERROR_CODES.VALIDATION_FAILED, "Event id and version are required together");
    }
    const event = input.payload.eventId
      ? await this.events.proposal(input.payload.eventId, input.payload.eventVersion!, input.actor.user.id)
      : null;
    if (event) {
      input = { ...input, payload: { ...input.payload, reviewedVenueId: null,
        title: event.title, description: event.description, activityType: "EVENT",
        proposedStartAt: event.startsAt.toISOString(), durationMinutes: Math.ceil((event.endsAt.getTime() - event.startsAt.getTime()) / 60000),
        timezone: event.timezone, publicLocality: event.locality, venueName: event.venueName, venueAddress: event.venueAddress,
      } };
    }
    assertSafePlan(input.payload);
    assertFutureDate(input.payload.proposedStartAt);
    const reviewedVenue = input.payload.reviewedVenueId
      ? await this.findSelectableVenue(input.payload.reviewedVenueId)
      : null;

    if (input.payload.idempotencyKey) {
      const existing = await this.repository.findIdempotent({
        matchId: match.id,
        createdByUserId: input.actor.user.id,
        idempotencyKey: input.payload.idempotencyKey,
      });
      if (existing) {
        if (!isSameProposal(existing, input.payload)) {
          throw new AppException(409, ERROR_CODES.IDEMPOTENCY_CONFLICT, "Idempotency key was already used for a different date plan");
        }
        return { datePlan: mapDatePlan(existing, input.actor.user.id) };
      }
    }

    let plan: DatePlanRecord;
    try {
      plan = await this.prisma.$transaction(async (tx) => {
        // Lock event before the relationship locks, matching admin updates and acceptance.
        if (event) {
          await this.events.lockAvailable(event.id, event.version, tx);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${mediaPairKey(match.userLowId, match.userHighId)}, 0))`;
          await tx.$queryRaw`SELECT id FROM "Match" WHERE id = ${match.id}::uuid FOR UPDATE`;
          await this.events.assertMatchEligible(match.id, input.actor.user.id, tx);
        }
        const created = await tx.datePlan.create({
          data: {
            matchId: match.id,
            ...(event ? { eventId: event.id, eventVersion: event.version, eventSnapshot: {
              title: event.title, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt.toISOString(),
              venueName: event.venueName, venueAddress: event.venueAddress, sourceUrl: event.sourceUrl,
              priceMinPaise: event.priceMinPaise, priceMaxPaise: event.priceMaxPaise, currency: event.currency,
            } } : {}),
            createdByUserId: input.actor.user.id,
            reviewedVenueId: reviewedVenue?.id ?? null,
            status: "PROPOSED",
            proposalVersion: 1,
            title: input.payload.title.trim(),
            description: input.payload.description.trim(),
            activityType: input.payload.activityType.trim(),
            proposedStartAt: new Date(input.payload.proposedStartAt),
            durationMinutes: input.payload.durationMinutes,
            timezone: input.payload.timezone,
            publicLocality: reviewedVenue?.publicLocality ?? input.payload.publicLocality.trim(),
            venueName: reviewedVenue?.name ?? cleanNullable(input.payload.venueName),
            venueAddress: reviewedVenue?.address ?? cleanNullable(input.payload.venueAddress),
            latitude: reviewedVenue?.latitude ?? null,
            longitude: reviewedVenue?.longitude ?? null,
            exactVenueVisibleAt: reviewedVenue || input.payload.venueName ? new Date() : null,
            idempotencyKey: input.payload.idempotencyKey ?? null,
            responses: {
              create: {
                userId: input.actor.user.id,
                proposalVersion: 1,
                response: "ACCEPTED",
              },
            },
          },
          include: DATE_PLAN_INCLUDE,
        });
        await appendSystemMessage(tx, match.id, input.actor.user.id, `Date proposed · ${created.title}`);
        await this.auditLog.write(
          {
            actorUserId: input.actor.user.id,
            actorSessionId: input.actor.session.id,
            action: "date-plan.propose",
            entityType: "DatePlan",
            entityId: created.id,
            targetUserId: this.policy.otherParticipant(input.actor.user.id, match),
            metadata: { matchId: match.id, proposalVersion: 1 },
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      if (input.payload.idempotencyKey && isUniqueConstraintError(error)) {
        const existing = await this.repository.findIdempotent({
          matchId: match.id,
          createdByUserId: input.actor.user.id,
          idempotencyKey: input.payload.idempotencyKey,
        });
        if (existing && isSameProposal(existing, input.payload)) {
          return { datePlan: mapDatePlan(existing, input.actor.user.id) };
        }
        throw new AppException(409, ERROR_CODES.IDEMPOTENCY_CONFLICT, "Concurrent date-plan request used this idempotency key");
      }
      throw error;
    }

    const recipientId = this.policy.otherParticipant(input.actor.user.id, match);
    await this.notifySafely({
      userId: recipientId,
      actorUserId: input.actor.user.id,
      type: "DATE_PROPOSED",
      title: "A date idea is waiting",
      body: `${plan.title} was proposed. Review the details when you are ready.`,
      data: { matchId: match.id, datePlanId: plan.id },
      dedupeKey: `DATE_PROPOSED:${plan.id}:1:${recipientId}`,
    });
    await this.writeAnalytics(input.actor.user.id, "date_proposed", { matchId: match.id, datePlanId: plan.id });
    return { datePlan: mapDatePlan(plan, input.actor.user.id) };
  }

  async listForMatch(input: {
    userId: string;
    matchId: string;
    cursor?: string;
    limit?: number;
  }): Promise<DatePlanPageDto> {
    const match = await this.repository.findMatchContext(input.matchId);
    this.policy.assertMatchParticipant(input.userId, match);
    const page = await this.repository.listForMatch({
      matchId: input.matchId,
      cursor: input.cursor,
      limit: Math.min(input.limit ?? 20, 50),
    });
    return { items: page.items.map((plan) => mapDatePlan(plan, input.userId)), nextCursor: page.nextCursor };
  }

  async listForUser(input: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<DatePlanPageDto> {
    const page = await this.repository.listForUser({
      userId: input.userId,
      cursor: input.cursor,
      limit: Math.min(input.limit ?? 20, 50),
    });
    return { items: page.items.map((plan) => mapDatePlan(plan, input.userId)), nextCursor: page.nextCursor };
  }

  async get(userId: string, datePlanId: string): Promise<DatePlanResponseDto> {
    const plan = await this.repository.findById(datePlanId);
    this.policy.assertPlanParticipant(userId, plan);
    return { datePlan: mapDatePlan(plan, userId) };
  }

  async accept(input: { actor: AuthContext; datePlanId: string }): Promise<DatePlanResponseDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      let plan = await this.repository.findById(input.datePlanId, tx);
      this.policy.assertPlanParticipant(input.actor.user.id, plan);
      if (plan.eventId) {
        await this.events.assertEnabled(input.actor.user.id);
        await this.events.lockAvailable(plan.eventId, plan.eventVersion!, tx);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${mediaPairKey(plan.match.userLowId, plan.match.userHighId)}, 0))`;
        await tx.$queryRaw`SELECT id FROM "Match" WHERE id = ${plan.matchId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "DatePlan" WHERE id = ${plan.id}::uuid FOR UPDATE`;
        await this.events.assertMatchEligible(plan.matchId, input.actor.user.id, tx);
        plan = await this.repository.findById(input.datePlanId, tx);
        this.policy.assertPlanParticipant(input.actor.user.id, plan);
      }
      this.policy.assertPlanMatchActive(plan);
      this.policy.assertCanRespond(plan, ["PROPOSED", "COUNTERED"]);

      const currentResponse = plan.responses.find(
        (response) => response.userId === input.actor.user.id && response.proposalVersion === plan.proposalVersion,
      );
      if (currentResponse?.response === "ACCEPTED") return plan;

      await tx.datePlanResponse.upsert({
        where: {
          datePlanId_userId_proposalVersion: {
            datePlanId: plan.id,
            userId: input.actor.user.id,
            proposalVersion: plan.proposalVersion,
          },
        },
        create: {
          datePlanId: plan.id,
          userId: input.actor.user.id,
          proposalVersion: plan.proposalVersion,
          response: "ACCEPTED",
        },
        update: { response: "ACCEPTED", counterProposal: Prisma.JsonNull },
      });
      const acceptedCount = await tx.datePlanResponse.count({
        where: {
          datePlanId: plan.id,
          proposalVersion: plan.proposalVersion,
          response: "ACCEPTED",
        },
      });
      if (acceptedCount >= 2) {
        const transition = await tx.datePlan.updateMany({
          where: { id: plan.id, proposalVersion: plan.proposalVersion, status: { in: ["PROPOSED", "COUNTERED"] } },
          data: { status: "ACCEPTED", acceptedAt: new Date(), exactVenueVisibleAt: new Date() },
        });
        if (transition.count > 0) {
          await appendSystemMessage(tx, plan.matchId, input.actor.user.id, `Date accepted · ${plan.title}`);
        }
      }
      await this.auditLog.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "date-plan.accept",
          entityType: "DatePlan",
          entityId: plan.id,
          metadata: { proposalVersion: plan.proposalVersion, mutual: acceptedCount >= 2 },
        },
        tx,
      );
      const result = await this.repository.findById(plan.id, tx);
      if (!result) throw new Error("Date plan disappeared after acceptance");
      return result;
    });

    if (updated.status === "ACCEPTED") {
      const recipientId = this.policy.otherParticipant(input.actor.user.id, updated.match);
      await this.notifySafely({
        userId: recipientId,
        actorUserId: input.actor.user.id,
        type: "DATE_ACCEPTED",
        title: "Your date is confirmed",
        body: `${updated.title} is confirmed. See the plan for the latest time and place.`,
        data: { matchId: updated.matchId, datePlanId: updated.id },
        dedupeKey: `DATE_ACCEPTED:${updated.id}:${updated.proposalVersion}:${recipientId}`,
      });
      await this.writeAnalytics(input.actor.user.id, "date_accepted", { matchId: updated.matchId, datePlanId: updated.id });
      await this.scheduleAcceptedPlanJobs(updated);
    }
    return { datePlan: mapDatePlan(updated, input.actor.user.id) };
  }

  async counter(input: {
    actor: AuthContext;
    datePlanId: string;
    payload: CounterDatePlanDto;
  }): Promise<DatePlanResponseDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const plan = await this.repository.findById(input.datePlanId, tx);
      this.policy.assertPlanParticipant(input.actor.user.id, plan);
      if (plan.eventId) throw new AppException(409, ERROR_CODES.CONFLICT, "Choose an updated event and send a new invitation instead of changing event details");
      this.policy.assertPlanMatchActive(plan);
      this.policy.assertCanRespond(plan, ["PROPOSED", "COUNTERED"]);
      const nextVersion = plan.proposalVersion + 1;
      const reviewedVenue = input.payload.reviewedVenueId
        ? await this.findSelectableVenue(input.payload.reviewedVenueId, tx)
        : null;
      const patch = buildCounterPatch(input.payload, reviewedVenue);
      if (input.payload.proposedStartAt) {
        assertFutureDate(input.payload.proposedStartAt);
      }
      const transition = await tx.datePlan.updateMany({
        where: { id: plan.id, proposalVersion: plan.proposalVersion, status: { in: ["PROPOSED", "COUNTERED"] } },
        data: {
          ...patch,
          proposalVersion: nextVersion,
          status: "COUNTERED",
          acceptedAt: null,
          exactVenueVisibleAt: new Date(),
        },
      });
      if (transition.count !== 1) {
        throw new AppException(
          409,
          ERROR_CODES.DATE_PLAN_VERSION_CONFLICT,
          "This plan changed while you were responding. Review the latest version.",
        );
      }
      await tx.datePlanResponse.create({
        data: {
          datePlanId: plan.id,
          userId: input.actor.user.id,
          proposalVersion: nextVersion,
          response: "ACCEPTED",
          counterProposal: input.payload as Prisma.InputJsonValue,
        },
      });
      await appendSystemMessage(tx, plan.matchId, input.actor.user.id, `Date changed · ${input.payload.title ?? plan.title}`);
      await this.auditLog.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "date-plan.counter",
          entityType: "DatePlan",
          entityId: plan.id,
          metadata: { previousVersion: plan.proposalVersion, proposalVersion: nextVersion },
        },
        tx,
      );
      const result = await this.repository.findById(plan.id, tx);
      if (!result) throw new Error("Date plan disappeared after counter proposal");
      return result;
    });

    const recipientId = this.policy.otherParticipant(input.actor.user.id, updated.match);
    await this.notifySafely({
      userId: recipientId,
      actorUserId: input.actor.user.id,
      type: "DATE_CHANGED",
      title: "A date plan changed",
      body: `${updated.title} has a new suggestion for you to review.`,
      data: { matchId: updated.matchId, datePlanId: updated.id },
      dedupeKey: `DATE_CHANGED:${updated.id}:${updated.proposalVersion}:${recipientId}`,
    });
    return { datePlan: mapDatePlan(updated, input.actor.user.id) };
  }

  async decline(input: { actor: AuthContext; datePlanId: string }): Promise<DatePlanResponseDto> {
    return this.finishResponse(input, "DECLINED");
  }

  async cancel(input: { actor: AuthContext; datePlanId: string }): Promise<DatePlanResponseDto> {
    const plan = await this.transitionTerminal(input, ["PROPOSED", "COUNTERED", "ACCEPTED"], "CANCELLED");
    const recipientId = this.policy.otherParticipant(input.actor.user.id, plan.match);
    await this.notifySafely({
      userId: recipientId,
      actorUserId: input.actor.user.id,
      type: "DATE_CANCELLED",
      title: "Date plan cancelled",
      body: `${plan.title} was cancelled.`,
      data: { matchId: plan.matchId, datePlanId: plan.id },
      dedupeKey: `DATE_CANCELLED:${plan.id}:${recipientId}`,
    });
    await this.writeAnalytics(input.actor.user.id, "date_cancelled", { matchId: plan.matchId, datePlanId: plan.id });
    return { datePlan: mapDatePlan(plan, input.actor.user.id) };
  }

  async complete(input: { actor: AuthContext; datePlanId: string }): Promise<DatePlanResponseDto> {
    const plan = await this.transitionTerminal(input, ["ACCEPTED"], "COMPLETED");
    await this.writeAnalytics(input.actor.user.id, "date_completed", { matchId: plan.matchId, datePlanId: plan.id });
    return { datePlan: mapDatePlan(plan, input.actor.user.id) };
  }

  async checkIn(input: {
    actor: AuthContext;
    datePlanId: string;
    payload: DatePlanCheckInDto;
  }): Promise<DatePlanResponseDto> {
    const plan = await this.prisma.$transaction(async (tx) => {
      const current = await this.repository.findById(input.datePlanId, tx);
      this.policy.assertPlanParticipant(input.actor.user.id, current);
      this.policy.assertCanRespond(current, ["ACCEPTED", "COMPLETED"]);
      const now = new Date();
      await tx.postDateCheckIn.upsert({
        where: { datePlanId_userId: { datePlanId: current.id, userId: input.actor.user.id } },
        create: {
          datePlanId: current.id,
          userId: input.actor.user.id,
          safetyStatus: input.payload.safetyStatus,
          safetySubmittedAt: now,
          submittedAt: now,
        },
        update: {
          safetyStatus: input.payload.safetyStatus,
          safetySubmittedAt: now,
          submittedAt: now,
        },
      });
      await this.auditLog.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "date-plan.safety-check-in",
          entityType: "DatePlan",
          entityId: current.id,
          metadata: { safetyStatus: input.payload.safetyStatus },
        },
        tx,
      );
      const result = await this.repository.findById(current.id, tx);
      if (!result) throw new Error("Date plan disappeared after check-in");
      return result;
    });
    await this.writeAnalytics(input.actor.user.id, "safety_check_in_completed", {
      matchId: plan.matchId,
      datePlanId: plan.id,
      status: input.payload.safetyStatus,
    });
    return { datePlan: mapDatePlan(plan, input.actor.user.id) };
  }

  async submitPostDateResponse(input: {
    actor: AuthContext;
    datePlanId: string;
    payload: PostDateResponseDto;
  }): Promise<DatePlanResponseDto> {
    const { plan, notices } = await this.prisma.$transaction(async (tx) => {
      const initial = await this.repository.findById(input.datePlanId, tx);
      this.policy.assertPlanParticipant(input.actor.user.id, initial);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${mediaPairKey(initial.match.userLowId, initial.match.userHighId)}, 0))`;
      // Serialize both answers and match revocation before reading their outcome.
      await tx.$queryRaw`SELECT id FROM "Match" WHERE id = ${initial.matchId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "DatePlan" WHERE id = ${input.datePlanId}::uuid FOR UPDATE`;
      const current = await this.repository.findById(input.datePlanId, tx);
      this.policy.assertPlanParticipant(input.actor.user.id, current);
      this.policy.assertPlanMatchActive(current);
      this.policy.assertCanRespond(current, ["COMPLETED"]);
      const now = new Date();
      await tx.postDateCheckIn.upsert({
        where: { datePlanId_userId: { datePlanId: current.id, userId: input.actor.user.id } },
        create: {
          datePlanId: current.id,
          userId: input.actor.user.id,
          wantsToMeetAgain: input.payload.wantsToMeetAgain,
          postDateSubmittedAt: now,
          submittedAt: now,
        },
        update: {
          wantsToMeetAgain: input.payload.wantsToMeetAgain,
          postDateSubmittedAt: now,
          submittedAt: now,
        },
      });
      await this.auditLog.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "date-plan.post-date-response",
          entityType: "DatePlan",
          entityId: current.id,
          metadata: { submitted: true },
        },
        tx,
      );
      const result = await this.repository.findById(current.id, tx);
      if (!result) throw new Error("Date plan disappeared after post-date response");
      const notices = [];
      if (resolveMeetAgainOutcome(result) === "MUTUAL") {
        for (const userId of [result.match.userLowId, result.match.userHighId]) {
          notices.push(await this.notifications.persist(tx, {
            userId, type: "MUTUAL_MEET_AGAIN",
            title: "You both want to meet again",
            body: "The feeling is mutual. Take your time and plan what comes next together.",
            data: { matchId: result.matchId, datePlanId: result.id },
            dedupeKey: `MUTUAL_MEET_AGAIN:${result.id}:${userId}`,
          }));
        }
      }
      return { plan: result, notices };
    });

    await this.writeAnalytics(input.actor.user.id, "post_date_response_submitted", {
      matchId: plan.matchId,
      datePlanId: plan.id,
    });
    if (resolveMeetAgainOutcome(plan) === "MUTUAL") {
      for (const notice of notices) await this.notifications.dispatchPersisted(notice);
      await this.writeAnalytics(input.actor.user.id, "mutual_meet_again", {
        matchId: plan.matchId,
        datePlanId: plan.id,
      });
    }
    return { datePlan: mapDatePlan(plan, input.actor.user.id) };
  }

  private async finishResponse(
    input: { actor: AuthContext; datePlanId: string },
    response: "DECLINED",
  ): Promise<DatePlanResponseDto> {
    const plan = await this.prisma.$transaction(async (tx) => {
      const current = await this.repository.findById(input.datePlanId, tx);
      this.policy.assertPlanParticipant(input.actor.user.id, current);
      this.policy.assertPlanMatchActive(current);
      this.policy.assertCanRespond(current, ["PROPOSED", "COUNTERED"]);
      const now = new Date();
      await tx.datePlanResponse.upsert({
        where: {
          datePlanId_userId_proposalVersion: {
            datePlanId: current.id,
            userId: input.actor.user.id,
            proposalVersion: current.proposalVersion,
          },
        },
        create: {
          datePlanId: current.id,
          userId: input.actor.user.id,
          proposalVersion: current.proposalVersion,
          response,
        },
        update: { response, counterProposal: Prisma.JsonNull },
      });
      await tx.datePlan.update({ where: { id: current.id }, data: { status: "DECLINED", declinedAt: now } });
      await appendSystemMessage(tx, current.matchId, input.actor.user.id, `Date declined · ${current.title}`);
      const result = await this.repository.findById(current.id, tx);
      if (!result) throw new Error("Date plan disappeared after decline");
      return result;
    });
    return { datePlan: mapDatePlan(plan, input.actor.user.id) };
  }

  private async findSelectableVenue(
    venueId: string,
    executor: PrismaService | PrismaTransactionalClient = this.prisma,
  ): Promise<ReviewedVenue> {
    const venue = await executor.reviewedVenue.findFirst({
      where: {
        id: venueId,
        reviewStatus: "REVIEWED",
        operationalStatus: { not: "CLOSED" },
        deletedAt: null,
      },
    });
    if (!venue) {
      throw new AppException(
        404,
        ERROR_CODES.VENUE_NOT_FOUND,
        "This reviewed venue is no longer available. Choose another option or enter one manually.",
      );
    }
    return venue;
  }

  private async transitionTerminal(
    input: { actor: AuthContext; datePlanId: string },
    allowed: DatePlanRecord["status"][],
    next: "CANCELLED" | "COMPLETED",
  ): Promise<DatePlanRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.repository.findById(input.datePlanId, tx);
      this.policy.assertPlanParticipant(input.actor.user.id, current);
      this.policy.assertCanRespond(current, allowed);
      const now = new Date();
      await tx.datePlan.update({
        where: { id: current.id },
        data:
          next === "CANCELLED"
            ? { status: next, cancelledAt: now }
            : { status: next, completedAt: now },
      });
      await appendSystemMessage(
        tx,
        current.matchId,
        input.actor.user.id,
        next === "CANCELLED" ? `Date cancelled · ${current.title}` : `Date completed · ${current.title}`,
      );
      await this.auditLog.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: `date-plan.${next.toLowerCase()}`,
          entityType: "DatePlan",
          entityId: current.id,
        },
        tx,
      );
      const result = await this.repository.findById(current.id, tx);
      if (!result) throw new Error("Date plan disappeared during transition");
      return result;
    });
  }

  private async notifySafely(input: Parameters<CreateNotificationService["execute"]>[0]): Promise<void> {
    try {
      await this.notifications.execute(input);
    } catch (error) {
      this.logger.warn(`Date-plan notification failed: ${error instanceof Error ? error.name : "unknown"}`);
    }
  }

  private async scheduleAcceptedPlanJobs(plan: DatePlanRecord): Promise<void> {
    const startAtMs = plan.proposedStartAt.getTime();
    const nowMs = Date.now();
    const reminderAtMs = startAtMs - 24 * 60 * 60_000;
    const safetyAtMs = startAtMs + Math.min(Math.max(plan.durationMinutes / 2, 20), 60) * 60_000;

    try {
      await Promise.all([
        this.bullmqProducer.enqueue(
          "date-plan.reminder",
          { datePlanId: plan.id, kind: "DATE_REMINDER" as const },
          {
            jobId: `date-plan.reminder:${plan.id}:${plan.proposalVersion}`,
            delayMs: Math.max(0, reminderAtMs - nowMs),
          },
        ),
        this.bullmqProducer.enqueue(
          "date-plan.reminder",
          { datePlanId: plan.id, kind: "SAFETY_CHECK_IN" as const },
          {
            jobId: `date-plan.safety:${plan.id}:${plan.proposalVersion}`,
            delayMs: Math.max(0, safetyAtMs - nowMs),
          },
        ),
      ]);
    } catch (error) {
      this.logger.warn(`Date-plan scheduling failed: ${error instanceof Error ? error.name : "unknown"}`);
    }
  }

  private async writeAnalytics(userId: string, eventName: string, properties: Record<string, unknown>): Promise<void> {
    try {
      await this.analytics.write({ userId, eventName, properties });
    } catch (error) {
      this.logger.warn(`Date-plan analytics failed: ${error instanceof Error ? error.name : "unknown"}`);
    }
  }
}

function mapDatePlan(plan: DatePlanRecord, viewerId: string): DatePlanDto {
  const myCheckIn = plan.checkIns.find((checkIn) => checkIn.userId === viewerId);
  return {
    id: plan.id,
    eventId: plan.eventId,
    eventVersion: plan.eventVersion,
    eventChanged: Boolean(plan.event && plan.event.version !== plan.eventVersion),
    eventUnavailable: Boolean(plan.event && eventUnavailable(plan.event)),
    matchId: plan.matchId,
    createdByUserId: plan.createdByUserId,
    status: plan.status,
    proposalVersion: plan.proposalVersion,
    title: plan.title,
    description: plan.description,
    activityType: plan.activityType,
    proposedStartAt: plan.proposedStartAt.toISOString(),
    durationMinutes: plan.durationMinutes,
    timezone: plan.timezone,
    publicLocality: plan.publicLocality,
    venueName: plan.venueName,
    venuePhotoUrl: plan.reviewedVenue?.photoUrl ?? null,
    venueAddress: plan.venueAddress,
    latitude: plan.latitude !== null ? Number(plan.latitude) : null,
    longitude: plan.longitude !== null ? Number(plan.longitude) : null,
    exactVenueVisibleAt: plan.exactVenueVisibleAt?.toISOString() ?? null,
    acceptedAt: plan.acceptedAt?.toISOString() ?? null,
    declinedAt: plan.declinedAt?.toISOString() ?? null,
    cancelledAt: plan.cancelledAt?.toISOString() ?? null,
    completedAt: plan.completedAt?.toISOString() ?? null,
    responses: plan.responses
      .filter((response) => response.proposalVersion === plan.proposalVersion)
      .map((response) => ({
        userId: response.userId,
        response: response.response,
        proposalVersion: response.proposalVersion,
        respondedAt: response.updatedAt.toISOString(),
      })),
    mySafetyStatus: myCheckIn?.safetyStatus ?? null,
    myPostDateResponseSubmitted: myCheckIn?.wantsToMeetAgain !== null && myCheckIn?.wantsToMeetAgain !== undefined,
    meetAgainOutcome: resolveMeetAgainOutcome(plan),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function resolveMeetAgainOutcome(plan: DatePlanRecord): DatePlanDto["meetAgainOutcome"] {
  return resolveMutualMeetAgain(plan.checkIns.map((checkIn) => checkIn.wantsToMeetAgain));
}

function buildCounterPatch(
  payload: CounterDatePlanDto,
  reviewedVenue: ReviewedVenue | null,
): Prisma.DatePlanUpdateManyMutationInput {
  return {
    ...(payload.title !== undefined ? { title: payload.title.trim() } : {}),
    ...(payload.description !== undefined ? { description: payload.description.trim() } : {}),
    ...(payload.activityType !== undefined ? { activityType: payload.activityType.trim() } : {}),
    ...(payload.proposedStartAt !== undefined ? { proposedStartAt: new Date(payload.proposedStartAt) } : {}),
    ...(payload.durationMinutes !== undefined ? { durationMinutes: payload.durationMinutes } : {}),
    ...(payload.timezone !== undefined ? { timezone: payload.timezone } : {}),
    ...(payload.publicLocality !== undefined ? { publicLocality: payload.publicLocality.trim() } : {}),
    ...(payload.reviewedVenueId !== undefined
      ? { reviewedVenueId: reviewedVenue?.id ?? null }
      : {}),
    ...(reviewedVenue
      ? {
          publicLocality: reviewedVenue.publicLocality,
          venueName: reviewedVenue.name,
          venueAddress: reviewedVenue.address,
          latitude: reviewedVenue.latitude,
          longitude: reviewedVenue.longitude,
        }
      : {}),
    ...(!reviewedVenue && payload.venueName !== undefined
      ? { venueName: cleanNullable(payload.venueName) }
      : {}),
    ...(!reviewedVenue && payload.venueAddress !== undefined
      ? { venueAddress: cleanNullable(payload.venueAddress) }
      : {}),
  };
}

async function appendSystemMessage(
  tx: PrismaTransactionalClient,
  matchId: string,
  senderId: string,
  textBody: string,
): Promise<void> {
  const conversation = await tx.conversation.findUnique({ where: { matchId }, select: { id: true } });
  if (!conversation) return;
  const updated = await tx.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageSequence: { increment: 1 },
      lastMessagePreview: textBody.slice(0, 160),
      lastMessageType: "SYSTEM",
      lastMessageSentAt: new Date(),
      lastSenderId: senderId,
    },
    select: { id: true, lastMessageSequence: true },
  });
  await tx.message.create({
    data: {
      conversationId: updated.id,
      senderId,
      sequence: updated.lastMessageSequence,
      type: "SYSTEM",
      textBody,
      status: "ACTIVE",
    },
  });
}

function assertFutureDate(value: string): void {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() - 5 * 60_000) {
    throw new AppException(400, ERROR_CODES.VALIDATION_FAILED, "Date plan time must be in the future");
  }
}

function assertSafePlan(payload: Pick<CreateDatePlanDto, "title" | "description" | "activityType">): void {
  const text = `${payload.title} ${payload.description} ${payload.activityType}`;
  const unsafe = [/\b(home|apartment|flat|hotel)\b/i, /\blong drive\b/i, /\bisolated\b/i, /\b(bar|pub|nightclub)\b/i, /paid companion/i];
  if (unsafe.some((pattern) => pattern.test(text))) {
    throw new AppException(400, ERROR_CODES.DATE_PLAN_UNSAFE_SUGGESTION, "Choose a public, first-date-safe activity");
  }
}

function isSameProposal(plan: DatePlanRecord, payload: CreateDatePlanDto): boolean {
  const sameCoreProposal =
    (plan.eventId ?? null) === (payload.eventId ?? null) &&
    (plan.eventVersion ?? null) === (payload.eventVersion ?? null) &&
    plan.title === payload.title.trim() &&
    plan.description === payload.description.trim() &&
    plan.activityType === payload.activityType.trim() &&
    plan.proposedStartAt.toISOString() === new Date(payload.proposedStartAt).toISOString() &&
    plan.durationMinutes === payload.durationMinutes &&
    plan.timezone === payload.timezone &&
    plan.reviewedVenueId === (payload.reviewedVenueId ?? null);
  if (!sameCoreProposal) return false;
  if (payload.reviewedVenueId) return true;
  return (
    plan.publicLocality === payload.publicLocality.trim() &&
    plan.venueName === cleanNullable(payload.venueName) &&
    plan.venueAddress === cleanNullable(payload.venueAddress)
  );
}

function cleanNullable(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

type VenueQueryRow = {
  id: string;
  name: string;
  photoUrl: string | null;
  address: string;
  publicLocality: string;
  reviewSource: string | null;
  reviewedAt: Date | null;
  operationalStatus: "OPEN" | "CLOSED" | "UNKNOWN";
  category: VenueCategoryValue | "OTHER";
  priceMaxPerPerson: number | null;
  rating: Prisma.Decimal | number | null;
  ratingCount: number | null;
  distanceKm: number | null;
  accessibilityFacts: string[];
  atmosphereTags: string[];
  isSynthetic: boolean;
};

function toPriceTier(priceMaxPerPerson: number | null): "₹" | "₹₹" | "₹₹₹" | null {
  if (priceMaxPerPerson == null) return null;
  if (priceMaxPerPerson <= 400) return "₹";
  if (priceMaxPerPerson <= 900) return "₹₹";
  return "₹₹₹";
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
