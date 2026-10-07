import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import wingmanConfig from "../../../config/wingman.config";
import { DatePlansService } from "../../date-plans/application/date-plans.service";
import { calculateGroupCenter } from "../../date-plans/domain/venue-geography";
import type { VenueSearchQueryDto } from "../../date-plans/dto/date-plans.dto";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { DuoPlan, DuoPlanResponse } from "../../../generated/prisma/client";
import { conversationParticipantIds, conversationUsers } from "../../conversations/domain/conversation-context";
import { ConversationRepository } from "../../conversations/infrastructure/conversations.infrastructure";
import type { CounterDuoPlanDto, CreateDuoPlanDto, DuoPlanDto, RespondDuoPlanDto } from "../dto/duo-plan.dto";

const OPEN_STATES = ["PROPOSED", "COUNTERED", "ACCEPTED"] as const;
type Plan = DuoPlan & { responses: DuoPlanResponse[] };

@Injectable()
export class DuoPlanService {
  constructor(private readonly prisma: PrismaService, private readonly conversations: ConversationRepository,
    private readonly events: DomainEventPublisher,
    private readonly venues: DatePlansService,
    @Inject(wingmanConfig.KEY) private readonly config: ConfigType<typeof wingmanConfig>) {}

  async venueSuggestions(userId: string, conversationId: string, query: VenueSearchQueryDto) {
    const group = await this.requireGroup(userId, conversationId);
    const users = group.members.map(member => member.user);
    const profiles = query.locationMode === "ME" ? users.filter(user => user.id === userId).map(user => user.profile) : users.map(user => user.profile);
    const points = profiles.flatMap(profile => profile?.locationLat != null && profile.locationLng != null && profile.locationUpdatedAt && Date.now() - profile.locationUpdatedAt.getTime() <= this.config.locationMaxAgeHours * 3600000
      ? [{ latitude: Number(profile.locationLat), longitude: Number(profile.locationLng) }] : []);
    const center = query.locationMode === "ME" ? points[0] ?? null : points.length === 4 ? calculateGroupCenter(points) : null;
    return this.venues.reviewedVenues(query, center);
  }

  async list(userId: string, conversationId: string): Promise<{ items: DuoPlanDto[] }> {
    await this.requireGroup(userId, conversationId);
    const plans = await this.prisma.duoPlan.findMany({ where: { conversationId }, include: { responses: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20 });
    return { items: plans.map(mapPlan) };
  }

  async create(userId: string, conversationId: string, payload: CreateDuoPlanDto): Promise<DuoPlanDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const group = await this.requireGroup(userId, conversationId, tx);
      const existing = await tx.duoPlan.findUnique({ where: { id: payload.requestId }, include: { responses: true } });
      if (existing) {
        if (existing.conversationId !== conversationId || existing.createdByUserId !== userId) throw conflict();
        return { plan: existing, recipients: conversationParticipantIds(group) };
      }
      if (await tx.duoPlan.findFirst({ where: { conversationId, status: { in: [...OPEN_STATES] } } })) throw conflict("Respond to the current plan first");
      const fields = validatedFields(payload);
      const plan = await tx.duoPlan.create({ data: { id: payload.requestId, conversationId, createdByUserId: userId, ...fields,
        responses: { create: { userId, version: 1, response: "ACCEPTED" } } }, include: { responses: true } });
      await tx.duoPlanRevision.create({ data: { requestId: payload.requestId, planId: plan.id, userId, version: 1, ...fields } });
      return { plan, recipients: conversationParticipantIds(group) };
    });
    return this.publish(result);
  }

  async respond(userId: string, planId: string, payload: RespondDuoPlanDto): Promise<DuoPlanDto> {
    return this.mutate(userId, planId, payload.expectedVersion, async (tx, plan) => {
      if (payload.action === "CANCEL" && plan.status === "CANCELLED") return;
      if (!OPEN_STATES.includes(plan.status as typeof OPEN_STATES[number])) throw conflict();
      if (payload.action === "ACCEPT" && new Date(plan.startAt).getTime() <= Date.now()) throw conflict("Choose a future meetup time");
      if (payload.action === "CANCEL") {
        await tx.duoPlan.update({ where: { id: planId }, data: { status: "CANCELLED" } });
        return;
      }
      await tx.duoPlanResponse.upsert({ where: { planId_userId_version: { planId, userId, version: plan.version } },
        create: { planId, userId, version: plan.version, response: payload.action === "ACCEPT" ? "ACCEPTED" : "DECLINED" },
        update: { response: payload.action === "ACCEPT" ? "ACCEPTED" : "DECLINED" } });
      const count = await tx.duoPlanResponse.count({ where: { planId, version: plan.version, response: "ACCEPTED" } });
      await tx.duoPlan.update({ where: { id: planId }, data: { status: payload.action === "DECLINE" ? "DECLINED" : count === 4 ? "ACCEPTED" : plan.status } });
    });
  }

  async counter(userId: string, planId: string, payload: CounterDuoPlanDto): Promise<DuoPlanDto> {
    return this.mutate(userId, planId, payload.expectedVersion, async (tx, plan) => {
      if (!OPEN_STATES.includes(plan.status as typeof OPEN_STATES[number])) throw conflict();
      const nextVersion = plan.version + 1;
      const fields = validatedFields(payload);
      await tx.duoPlanRevision.create({ data: { requestId: payload.requestId, planId, userId, version: nextVersion, ...fields } });
      await tx.duoPlan.update({ where: { id: planId }, data: { ...fields, version: nextVersion, status: "COUNTERED",
        responses: { create: { userId, version: nextVersion, response: "ACCEPTED" } } } });
    }, payload.requestId);
  }

  private async mutate(userId: string, planId: string, version: number, mutation: (tx: PrismaTransactionalClient, plan: Plan) => Promise<void>, requestId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const initial = await tx.duoPlan.findUnique({ where: { id: planId }, select: { conversationId: true } });
      if (!initial) throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Meetup not found");
      const group = await this.requireGroup(userId, initial.conversationId, tx);
      await tx.$queryRaw`SELECT id FROM "DuoPlan" WHERE id=${planId}::uuid FOR UPDATE`;
      const plan = await tx.duoPlan.findUniqueOrThrow({ where: { id: planId }, include: { responses: true } });
      if (requestId) {
        const replay = await tx.duoPlanRevision.findUnique({ where: { requestId } });
        if (replay) {
          if (replay.planId !== planId || replay.userId !== userId || replay.version !== version + 1) throw conflict();
          return { plan, recipients: conversationParticipantIds(group) };
        }
      }
      if (plan.version !== version) throw conflict("The plan changed. Review the latest version");
      await mutation(tx, plan);
      return { plan: await tx.duoPlan.findUniqueOrThrow({ where: { id: planId }, include: { responses: true } }), recipients: conversationParticipantIds(group) };
    });
    return this.publish(result);
  }

  private async requireGroup(userId: string, conversationId: string, tx?: PrismaTransactionalClient) {
    const group = await this.conversations.findByIdForUser(conversationId, userId, tx);
    if (!group?.duoMatchId || group.status !== "ACTIVE" || conversationUsers(group).some((user) => user.isChatFrozen))
      throw new AppException(404, ERROR_CODES.CONVERSATION_NOT_ACCESSIBLE, "Duo conversation is not available");
    return group;
  }

  private async publish(result: { plan: Plan; recipients: string[] }) {
    await this.events.publishSafely("duo.plan.updated", { conversationId: result.plan.conversationId, planId: result.plan.id, recipientUserIds: result.recipients });
    return mapPlan(result.plan);
  }
}

function validatedFields(payload: CreateDuoPlanDto) {
  const activity = payload.activity.trim(), venueName = payload.venueName.trim(), publicLocality = payload.publicLocality.trim();
  const startAt = new Date(payload.startAt);
  if (!activity || !venueName || !publicLocality || !Number.isFinite(startAt.getTime()) || startAt.getTime() <= Date.now())
    throw new AppException(400, ERROR_CODES.VALIDATION_FAILED, "Choose an activity, public place and future time");
  return { activity, venueName, publicLocality, startAt };
}

function mapPlan(plan: Plan): DuoPlanDto {
  return { id: plan.id, conversationId: plan.conversationId, status: plan.status, version: plan.version,
    activity: plan.activity, venueName: plan.venueName, publicLocality: plan.publicLocality, startAt: plan.startAt.toISOString(),
    acceptedUserIds: plan.responses.filter((response) => response.version === plan.version && response.response === "ACCEPTED").map((response) => response.userId), participantCount: 4 };
}

function conflict(message = "This meetup has changed") { return new AppException(409, ERROR_CODES.DATE_PLAN_INVALID_STATE, message); }
