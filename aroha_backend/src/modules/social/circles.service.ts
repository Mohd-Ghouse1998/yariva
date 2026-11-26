import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { decodeScopedCursor, encodeScopedCursor } from "../../common/utils/scoped-cursor.util";
import { PrismaService } from "../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../database/prisma/prisma.transaction";
import type { CircleRequestStatus, Prisma } from "../../generated/prisma/client";
import { mediaPairKey } from "../../integrations/object-storage/media-disclosure.service";
import { isSocialIntent } from "../discovery/domain/discovery.domain";
import { EvaluateFeatureFlagService } from "../feature-flags/application/feature-flags.services";
import { findActiveMatchPartnerIds } from "../matches/infrastructure/matches.infrastructure";
import { canViewProfileField } from "../profiles/domain/profile-field-audience";
import {
  acceptsIntent, CIRCLES_FLAG, conflict, DAY_MS, hasRosterBlock, isEligible, isPublic,
  type SocialUser, socialUser, unavailable,
} from "./social-access";
import type { ActivityContentDto, CircleListDto, CreateCircleActivityDto, CreateCircleDto, UpdateCircleActivityDto } from "./social.dto";

import { activityState, attendanceEligible, circleEligible, circleInclude, circleState, confirmedAttendees, type Circle } from "./circle-access";
import { SocialNoticeService, type PersistedSocialNotices } from "./social-notice.service";

const reviewedVenue = { reviewStatus: "REVIEWED", operationalStatus: { not: "CLOSED" }, deletedAt: null, isSynthetic: false } satisfies Prisma.ReviewedVenueWhereInput;

const activityInclude = {
  venue: { select: { id: true, name: true, publicLocality: true, reviewStatus: true, operationalStatus: true, deletedAt: true, isSynthetic: true } },
  responses: confirmedAttendees,
} satisfies Prisma.CircleActivityInclude;
type Activity = Prisma.CircleActivityGetPayload<{ include: typeof activityInclude }>;
const activeRequest = ["PENDING", "APPROVED"] as const;

@Injectable()
export class CirclesService {
  constructor(private readonly prisma: PrismaService, private readonly flags: EvaluateFeatureFlagService,
    private readonly notices: SocialNoticeService) {}

  async list(userId: string, query: CircleListDto) {
    const user = await this.requireUser(userId);
    if (query.scope) return this.listPage(user, query.scope, query.cursor);
    if (query.cursor) throw new BadRequestException("Choose a circle list before using a cursor");
    const [own, nearby] = await Promise.all([this.listPage(user, "own"), this.listPage(user, "nearby")]);
    return { items: [...own.items, ...nearby.items], nextOwnCursor: own.nextCursor, nextNearbyCursor: nearby.nextCursor };
  }

  private async listPage(user: SocialUser, scope: "own" | "nearby", cursor?: string) {
    const userId = user.id;
    const ownFilter: Prisma.CircleWhereInput = { OR: [
      { organizerId: userId },
      { memberships: { some: { userId } } },
      { activities: { some: { responses: { some: { userId } } } } },
    ] };
    const local = this.locality(user);
    const cursorScope = `circles:${scope}:${userId}`;
    const after = cursor ? decodeScopedCursor(cursor, cursorScope) : null;
    if (scope === "nearby" && !local) return { items: [], nextCursor: null };
    const scanLimit = 30;
    const circles = await this.prisma.circle.findMany({
      where: { AND: [
        scope === "own" ? ownFilter : { NOT: ownFilter, status: "OPEN", expiresAt: { gt: new Date() }, ...local },
        ...(after ? [{ OR: [
          { createdAt: { lt: after.createdAt } },
          { createdAt: after.createdAt, id: { lt: after.id } },
        ] }] : []),
      ] },
      include: {
        ...circleInclude,
        activities: { include: activityInclude, orderBy: { createdAt: "desc" }, take: 20 },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: scanLimit + 1,
    });
    const hasMore = circles.length > scanLimit;
    if (hasMore) circles.pop();
    const [memberships, responses, blocked, matches] = await Promise.all([
      this.prisma.circleMembership.findMany({
        where: { userId, circleId: { in: circles.map((circle) => circle.id) } },
        select: { circleId: true, status: true },
      }),
      this.responsesFor(userId, circles.flatMap((circle) => circle.activities.map((activity) => activity.id))),
      this.blockLookup([userId, ...circles.flatMap((circle) => [
        ...circle.memberships.map((row) => row.userId),
        ...circle.activities.flatMap((activity) => activity.responses.map((row) => row.userId)),
      ])]),
      findActiveMatchPartnerIds(this.prisma, userId, [...new Set(circles.map(circle => circle.organizerId))]),
    ]);
    const membershipByCircle = new Map(memberships.map((row) => [row.circleId, row.status]));
    const items = circles.map((circle) => {
      const own = membershipByCircle.get(circle.id) ?? null;
      const member = own === "APPROVED";
      const visible = circleEligible(circle, user, member) && !blocked(this.circleAudience(circle, user.id));
      const activities = circle.activities.flatMap((activity) => {
        const mine = responses.get(activity.id) ?? [];
        const canView = visible && (member || (activity.openToNearby && activityState(circle, activity) === "OPEN")) &&
          attendanceEligible(circle, activity, user) && !blocked(this.activityAudience(circle, activity, user.id));
        if (canView) return [this.activitySummary(circle, activity, mine, member)];
        return mine.length ? [this.unavailableActivity(activity.id, mine, activityState(circle, activity))] : [];
      });
      if (!visible) {
        return scope === "own" ? {
          id: circle.id, title: "Unavailable circle", description: "", locality: "",
          intent: null, capacity: 0, approvedCount: 0, ownStatus: own,
          state: circleState(circle) === "OPEN" ? "UNAVAILABLE" as const : circleState(circle),
          organizer: circle.organizerId === userId, redacted: true, activities,
        } : null;
      }
      return { ...this.circleSummary(circle, userId, own, matches.has(circle.organizerId)), activities };
    }).filter((circle) => circle !== null);
    const last = circles.at(-1);
    return { items, nextCursor: hasMore && last ? encodeScopedCursor(last, cursorScope) : null };
  }

  async venues(userId: string) {
    const user = await this.requireUser(userId);
    const profile = user.profile!;
    if (!profile.city || !profile.countryCode) return { items: [] };
    return { items: await this.prisma.reviewedVenue.findMany({
      where: { ...reviewedVenue, city: { equals: profile.city, mode: "insensitive" }, countryCode: profile.countryCode },
      orderBy: [{ name: "asc" }, { id: "asc" }], take: 20,
      select: { id: true, name: true, publicLocality: true },
    }) };
  }

  async get(userId: string, circleId: string) {
    const user = await this.requireUser(userId);
    const circle = await this.load(this.prisma, circleId);
    const own = await this.membership(this.prisma, circleId, userId);
    const member = own === "APPROVED";
    if (!await this.canSee(this.prisma, circle, user, member)) unavailable();

    const activities = await this.prisma.circleActivity.findMany({
      where: { circleId, ...(member ? {} : { OR: [{ openToNearby: true }, { responses: { some: { userId } } }] }) },
      include: activityInclude,
      orderBy: { createdAt: "desc" }, take: 20,
    });
    const organizer = circle.organizerId === userId;
    const canManage = organizer && circleState(circle) === "OPEN";
    const activityIds = activities.map((activity) => activity.id);
    const [responses, activityRequests, pending, matches] = await Promise.all([
      this.responsesFor(userId, activityIds),
      canManage ? this.prisma.circleActivityResponse.findMany({
        where: { activityId: { in: activityIds }, status: { in: [...activeRequest] } },
        include: { user: { select: socialUser } },
      }) : [],
      canManage ? this.prisma.circleMembership.findMany({
        where: { circleId, status: "PENDING" }, include: { user: { select: socialUser } }, take: 30,
      }) : [],
      findActiveMatchPartnerIds(this.prisma, userId, organizer ? [] : [circle.organizerId]),
    ]);
    if (!own && circleState(circle) !== "OPEN" && responses.size === 0) unavailable();
    const blocked = await this.blockLookup([
      ...this.circleAudience(circle, userId), ...pending.map((request) => request.userId),
      ...activityRequests.map((request) => request.userId),
      ...activities.flatMap((activity) => activity.responses.map((response) => response.userId)),
    ]);
    if (blocked(this.circleAudience(circle, userId))) unavailable();
    const requestsByActivity = new Map<string, typeof activityRequests>();
    for (const request of activityRequests) {
      const group = requestsByActivity.get(request.activityId) ?? [];
      group.push(request);
      requestsByActivity.set(request.activityId, group);
    }
    const mapped = activities.map((activity) => {
      const mine = responses.get(activity.id) ?? [];
      if (!member && !mine.length && activityState(circle, activity) !== "OPEN") return null;
      if ((!member && (!activity.openToNearby || activityState(circle, activity) !== "OPEN")) || !attendanceEligible(circle, activity, user) ||
          blocked(this.activityAudience(circle, activity, userId))) {
        return canManage || mine.length
          ? { ...this.unavailableActivity(activity.id, mine, activityState(circle, activity)), requests: [] } : null;
      }
      const requests = (requestsByActivity.get(activity.id) ?? []).flatMap(({ user: applicant, need, status }) => {
        const isMember = circle.memberships.some((row) => row.userId === applicant.id);
        return circleEligible(circle, applicant, isMember) && attendanceEligible(circle, activity, applicant) &&
          !blocked(this.activityAudience(circle, activity, applicant.id))
          ? [{ ...this.memberLabel(applicant), need, status }] : [];
      });
      return { ...this.activitySummary(circle, activity, mine, member), requests };
    }).filter((activity) => activity !== null);
    const requests = pending.flatMap(({ user: applicant }) =>
      isPublic(applicant.profile) && circleEligible(circle, applicant, false) && !blocked(this.circleAudience(circle, applicant.id))
        ? [this.memberLabel(applicant)] : []);
    const openMember = member && circleState(circle) === "OPEN";
    const chat = openMember ? await this.prisma.conversation.findFirst({
      where: { circleId, status: "ACTIVE" }, select: { id: true },
    }) : null;

    return {
      ...this.circleSummary(circle, userId, own, matches.has(circle.organizerId)),
      members: openMember ? circle.memberships.map(({ user: person }) => this.memberLabel(person)) : [],
      requests, chatId: chat?.id ?? null,
      reportableOrganizerId: !organizer && isPublic(circle.organizer.profile) ? circle.organizerId : null,
      activities: mapped,
    };
  }

  async create(userId: string, input: CreateCircleDto) {
    const user = await this.requireUser(userId);
    const profile = user.profile!;
    if (!isPublic(profile) || !profile.city || !profile.region || !profile.countryCode) unavailable();
    if (!isSocialIntent(input.intent) && !user.intents.some(({ intent }) => intent === input.intent)) {
      conflict("Select this intention in your profile before organizing");
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
      if (await tx.circle.count({ where: { organizerId: userId, status: "OPEN", expiresAt: { gt: new Date() } } }) >= 3) {
        conflict("Close an existing circle before starting another");
      }
      const { id } = await tx.circle.create({ data: {
        ...input, organizerId: userId, city: profile.city!, region: profile.region!, countryCode: profile.countryCode!,
        expiresAt: new Date(Date.now() + 14 * DAY_MS),
        memberships: { create: { userId, status: "APPROVED", chatGrantId: randomUUID() } },
      } });
      await this.rotateChat(tx, id, [userId]);
      return { id };
    });
  }

  async request(userId: string, circleId: string) {
    await this.requireUser(userId);
    return this.locked(circleId, async (tx, circle, notify) => {
      const own = await this.membership(tx, circleId, userId);
      const user = await this.requireUser(userId, tx);
      await this.lockPairs(tx, userId, circle.memberships.map((row) => row.userId));
      if (!await this.canSee(tx, circle, user, own === "APPROVED")) unavailable();
      if (own === "APPROVED" || own === "PENDING") return { status: own };
      if (!isPublic(user.profile)) conflict("Make your profile visible to request circle membership");
      this.assertOpen(circle);
      if (circle.memberships.length >= circle.capacity) conflict("This circle is full");
      if (own === "REMOVED" || own === "DECLINED") conflict("This request can no longer be submitted");
      if (await tx.circleMembership.count({ where: { circleId, status: "PENDING" } }) >= 30) conflict("This circle has too many pending requests");
      const requestId = randomUUID();
      await tx.circleMembership.upsert({
        where: { circleId_userId: { circleId, userId } }, create: { circleId, userId, requestId },
        update: { status: "PENDING", requestId },
      });
      await notify({ route: "circle-membership", circleId, applicantId: userId, requestId, status: "PENDING" }, [circle.organizerId]);
      return { status: "PENDING" as const };
    });
  }

  async decide(userId: string, circleId: string, targetId: string, approve: boolean) {
    await this.requireUser(userId);
    return this.locked(circleId, async (tx, circle, notify) => {
      this.assertOrganizer(circle, userId);
      this.assertOpen(circle);
      const where = { circleId_userId: { circleId, userId: targetId } };
      const current = await tx.circleMembership.findUnique({ where });
      const status = approve ? "APPROVED" : "DECLINED";
      if (current?.status === status && targetId !== userId) return { status };
      if (current?.status !== "PENDING") unavailable();
      if (approve) {
        const target = await this.requireUser(targetId, tx);
        await this.lockPairs(tx, targetId, circle.memberships.map((row) => row.userId));
        if (!isPublic(target.profile) || !await this.canSee(tx, circle, target, false)) unavailable();
        if (circle.memberships.length >= circle.capacity) conflict("This circle is full");
      }
      const requestId = current.requestId ?? randomUUID();
      await tx.circleMembership.update({ where, data: { status, requestId, chatGrantId: approve ? randomUUID() : null } });
      if (approve) await this.rotateChat(tx, circleId, [...circle.memberships.map((row) => row.userId), targetId]);
      await notify({ route: "circle-membership", circleId, applicantId: targetId, requestId, status }, [targetId]);
      return { status };
    });
  }

  async leave(userId: string, circleId: string, targetId = userId) {
    await this.requireUser(userId);
    return this.locked(circleId, async (tx, circle) => {
      if (targetId !== userId) this.assertOrganizer(circle, userId);
      if (targetId === circle.organizerId) conflict("Close or cancel the circle before leaving");
      const status = targetId === userId ? "WITHDRAWN" : "REMOVED";
      const current = await this.membership(tx, circleId, targetId);
      if (current === status) return { status };
      if (current !== "APPROVED" && current !== "PENDING") unavailable();
      await tx.circleMembership.update({ where: { circleId_userId: { circleId, userId: targetId } },
        data: { status, chatGrantId: null } });
      await tx.circleActivityResponse.updateMany({
        where: { activity: { circleId }, userId: targetId, status: { in: [...activeRequest] } },
        data: { status },
      });
      if (current === "APPROVED" && circleState(circle) === "OPEN") {
        await this.rotateChat(tx, circleId, circle.memberships.map((row) => row.userId).filter((id) => id !== targetId));
      }
      return { status };
    });
  }

  async close(userId: string, circleId: string, cancel: boolean) {
    await this.requireUser(userId);
    return this.locked(circleId, async (tx, circle) => {
      this.assertOrganizer(circle, userId);
      const current = circleState(circle);
      if (current !== "OPEN") return { status: current };
      const status = cancel ? "CANCELLED" : "CLOSED";
      await tx.circle.update({ where: { id: circleId }, data: { status } });
      await this.rotateChat(tx, circleId, []);
      return { status };
    });
  }

  async recover(userId: string, circleId: string) {
    await this.requireUser(userId);
    return this.locked(circleId, async (tx, circle) => {
      this.assertOrganizer(circle, userId);
      if (circleState(circle) !== "OPEN") return { recovered: false };
      const activities = await tx.circleActivity.findMany({
        where: { circleId, cancelledAt: null, expiresAt: { gt: new Date() } }, include: activityInclude,
      });
      const ids = [...new Set([...circle.memberships, ...activities.flatMap((item) => item.responses)].map((row) => row.userId))];
      const blocks = await tx.block.findMany({
        where: { blockerId: { in: ids }, blockedId: { in: ids }, deletedAt: null },
        select: { id: true, blockerId: true, blockedId: true },
      });
      for (const key of [...new Set(blocks.map((row) => mediaPairKey(row.blockerId, row.blockedId)))].sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
      }
      const currentBlocks = await tx.block.findMany({
        where: { id: { in: blocks.map((row) => row.id) }, deletedAt: null },
        select: { blockerId: true, blockedId: true },
      });
      const blocked = new Set(currentBlocks.map((row) => mediaPairKey(row.blockerId, row.blockedId)));
      const recoverable = (people: SocialUser[], protectedIds: Set<string>) => {
        const affected = new Set(people.filter((person) => !protectedIds.has(person.id) && !isEligible(person)).map((person) => person.id));
        const eligible = people.filter((person) => !affected.has(person.id));
        for (const [index, person] of eligible.entries()) {
          for (const other of eligible.slice(index + 1)) {
            if (!blocked.has(mediaPairKey(person.id, other.id)) &&
                acceptsIntent(person, other, circle.intent) && acceptsIntent(other, person, circle.intent)) continue;
            if (!protectedIds.has(person.id)) affected.add(person.id);
            if (!protectedIds.has(other.id)) affected.add(other.id);
          }
        }
        return [...affected];
      };
      const members = circle.memberships.map(({ user }) => user);
      const removedMembers = recoverable(members, new Set([userId]));
      const continuing = members.filter((person) => !removedMembers.includes(person.id));
      if (removedMembers.length) {
        await tx.circleMembership.updateMany({
          where: { circleId, userId: { in: removedMembers }, status: "APPROVED" },
          data: { status: "REMOVED", chatGrantId: null },
        });
        await tx.circleActivityResponse.updateMany({
          where: { activity: { circleId }, userId: { in: removedMembers }, status: { in: [...activeRequest] } },
          data: { status: "REMOVED" },
        });
        await this.rotateChat(tx, circleId, continuing.map((person) => person.id));
      }
      const roster = new Set(continuing.map((person) => person.id));
      let recovered = removedMembers.length > 0;
      for (const activity of activities) {
        const guests = activity.responses.map(({ user }) => user).filter((person) => !roster.has(person.id) && !removedMembers.includes(person.id));
        const affected = recoverable([...continuing, ...guests], roster);
        if (!affected.length) continue;
        await tx.circleActivityResponse.updateMany({
          where: { activityId: activity.id, userId: { in: affected }, status: { in: [...activeRequest] } },
          data: { status: "REMOVED" },
        });
        recovered = true;
      }
      return { recovered };
    });
  }

  async createActivity(userId: string, circleId: string, input: CreateCircleActivityDto) {
    await this.requireUser(userId);
    return this.locked(circleId, async (tx, circle) => {
      this.assertOrganizer(circle, userId);
      this.assertOpen(circle);
      if (!await this.canSee(tx, circle, circle.organizer, true)) unavailable();
      if (await tx.circleActivity.count({ where: { circleId } }) >= 20) conflict("This circle has reached its activity limit");
      const { id } = await tx.circleActivity.create({
        data: { ...await this.activityData(tx, circle, input), helpNeeds: input.helpNeeds, circleId },
      });
      return { id };
    });
  }

  async updateActivity(userId: string, circleId: string, activityId: string, input: UpdateCircleActivityDto | null) {
    await this.requireUser(userId);
    return this.locked(circleId, async (tx, circle, notify) => {
      this.assertOrganizer(circle, userId);
      const activity = await this.activity(tx, circleId, activityId);
      if (!input && activity.cancelledAt) return { version: activity.version };
      if (input && input.version !== activity.version) conflict("Refresh this activity and try again");
      if (input && activityState(circle, activity) !== "OPEN") conflict("This activity is no longer open");
      if (input && !await this.canSee(tx, circle, circle.organizer, true)) unavailable();
      if (input && input.capacity < activity.responses.length) conflict("Capacity cannot be lower than confirmed attendance");
      const updated = await tx.circleActivity.update({
        where: { id: activityId },
        data: { ...(input ? await this.activityData(tx, circle, input) : { cancelledAt: new Date() }), version: { increment: 1 } },
        select: { version: true },
      });
      if (input && !input.openToNearby && activity.openToNearby) {
        await tx.circleActivityResponse.updateMany({
          where: { activityId, userId: { notIn: circle.memberships.map((row) => row.userId) }, status: { in: [...activeRequest] } },
          data: { status: "REMOVED" },
        });
      }
      const recipients = await tx.circleActivityResponse.findMany({
        where: { activityId, userId: { not: userId }, status: { in: [...activeRequest] } },
        distinct: ["userId"], select: { userId: true },
      });
      await notify({ route: "circle-activity", circleId, activityId, status: input ? "UPDATED" : "CANCELLED", version: updated.version },
        recipients.map((row) => row.userId));
      return updated;
    });
  }

  async respond(userId: string, circleId: string, activityId: string, need: number, withdraw: boolean) {
    await this.requireUser(userId);
    return this.locked(circleId, async (tx, circle, notify) => {
      const activity = await this.activity(tx, circleId, activityId);
      const key = { activityId, userId, need };
      const where = { activityId_userId_need: key };
      const existing = await tx.circleActivityResponse.findUnique({ where });
      if (withdraw) {
        if (existing?.status === "WITHDRAWN") return { status: "WITHDRAWN" as const };
        if (existing?.status !== "PENDING" && existing?.status !== "APPROVED") unavailable();
        await tx.circleActivityResponse.update({ where, data: { status: "WITHDRAWN" } });
        return { status: "WITHDRAWN" as const };
      }
      if (!Number.isInteger(need) || need < 0 || need > activity.helpNeeds.length) unavailable();
      const user = await this.requireUser(userId, tx);
      const membership = await this.membership(tx, circleId, userId);
      if (membership === "REMOVED") unavailable();
      const member = membership === "APPROVED";
      const others = [...circle.memberships, ...activity.responses].map((row) => row.userId);
      await this.lockPairs(tx, userId, others);
      if ((!member && (need > 0 || !activity.openToNearby)) ||
          !await this.canSeeActivity(tx, circle, activity, user)) unavailable();
      if (existing?.status === "PENDING" || existing?.status === "APPROVED") return { status: existing.status };
      if (existing?.status === "REMOVED" || existing?.status === "DECLINED") conflict("This response can no longer be submitted");
      if (activityState(circle, activity) !== "OPEN") conflict("This activity is no longer open");
      if (need === 0 && activity.responses.length >= activity.capacity) conflict("This activity is full");
      if (await tx.circleActivityResponse.count({ where: { activityId, status: "PENDING" } }) >= 30) conflict("This activity has too many pending requests");
      const requestId = randomUUID();
      await tx.circleActivityResponse.upsert({ where, create: { ...key, requestId }, update: { status: "PENDING", requestId } });
      if (userId !== circle.organizerId) {
        await notify({ route: "circle-activity", circleId, activityId, applicantId: userId, need, requestId, status: "PENDING" }, [circle.organizerId]);
      }
      return { status: "PENDING" as const };
    });
  }

  async decideActivity(userId: string, circleId: string, activityId: string, targetId: string, need: number, approve: boolean) {
    await this.requireUser(userId);
    return this.locked(circleId, async (tx, circle, notify) => {
      this.assertOrganizer(circle, userId);
      const activity = await this.activity(tx, circleId, activityId);
      const where = { activityId_userId_need: { activityId, userId: targetId, need } };
      const existing = await tx.circleActivityResponse.findUnique({ where });
      const status = approve ? "APPROVED" : existing?.status === "APPROVED" ? "REMOVED" : "DECLINED";
      if (existing?.status === status) return { status };
      if (existing?.status !== "PENDING" && !(existing?.status === "APPROVED" && !approve)) unavailable();
      if (approve) {
        if (activityState(circle, activity) !== "OPEN") conflict("This activity is no longer open");
        const target = await this.requireUser(targetId, tx);
        const membership = await this.membership(tx, circleId, targetId);
        if (membership === "REMOVED") unavailable();
        const member = membership === "APPROVED";
        await this.lockPairs(tx, targetId, [...circle.memberships, ...activity.responses].map((row) => row.userId));
        if ((!member && (need > 0 || !activity.openToNearby)) ||
            !await this.canSeeActivity(tx, circle, activity, target)) unavailable();
        if (need === 0 && activity.responses.length >= activity.capacity) conflict("This activity is full");
      }
      const requestId = existing.requestId ?? randomUUID();
      await tx.circleActivityResponse.update({ where, data: { status, requestId } });
      if (userId !== targetId) {
        await notify({ route: "circle-activity", circleId, activityId, applicantId: targetId, need, requestId, status }, [targetId]);
      }
      return { status };
    });
  }

  private async requireUser(id: string, tx: PrismaTransactionalClient = this.prisma): Promise<SocialUser> {
    const flag = await this.flags.execute({ key: CIRCLES_FLAG, userId: id });
    if (!flag.enabled) unavailable();
    const user = await tx.user.findUnique({ where: { id }, select: socialUser });
    if (!user || !isEligible(user)) unavailable();
    return user;
  }

  private async locked<T>(id: string, fn: (tx: PrismaTransactionalClient, circle: Circle,
    notify: (data: Parameters<SocialNoticeService["persist"]>[1], recipients: string[]) => Promise<void>) => Promise<T>) {
    const notices: PersistedSocialNotices = [];
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Circle" WHERE id = ${id}::uuid FOR UPDATE`;
      return fn(tx, await this.load(tx, id), async (data, recipients) => {
        notices.push(...await this.notices.persist(tx, data, recipients));
      });
    });
    await this.notices.dispatch(notices);
    return result;
  }

  private async load(tx: PrismaTransactionalClient, id: string) {
    const circle = await tx.circle.findUnique({ where: { id }, include: circleInclude });
    if (!circle) unavailable();
    return circle;
  }

  private async membership(tx: PrismaTransactionalClient, circleId: string, userId: string) {
    return (await tx.circleMembership.findUnique({
      where: { circleId_userId: { circleId, userId } }, select: { status: true },
    }))?.status ?? null;
  }

  private async activity(tx: PrismaTransactionalClient, circleId: string, id: string) {
    const activity = await tx.circleActivity.findFirst({ where: { id, circleId }, include: activityInclude });
    if (!activity) unavailable();
    return activity;
  }

  private async responsesFor(userId: string, ids: string[]) {
    const responses = await this.prisma.circleActivityResponse.findMany({
      where: { activityId: { in: ids }, userId }, select: { activityId: true, need: true, status: true },
    });
    const byActivity = new Map<string, { need: number; status: CircleRequestStatus }[]>();
    for (const { activityId, need, status } of responses) {
      const group = byActivity.get(activityId) ?? [];
      group.push({ need, status });
      byActivity.set(activityId, group);
    }
    return byActivity;
  }

  private circleAudience(circle: Circle, userId: string) {
    return [...new Set([userId, ...circle.memberships.map((row) => row.userId)])];
  }

  private activityAudience(circle: Circle, activity: Activity, userId: string) {
    return [...new Set([...this.circleAudience(circle, userId), ...activity.responses.map((row) => row.userId)])];
  }

  private async canSee(tx: PrismaTransactionalClient, circle: Circle, user: SocialUser, member: boolean) {
    return circleEligible(circle, user, member) && !await hasRosterBlock(tx, this.circleAudience(circle, user.id));
  }

  private async canSeeActivity(tx: PrismaTransactionalClient, circle: Circle, activity: Activity, user: SocialUser) {
    const member = circle.memberships.some((row) => row.userId === user.id);
    return circleEligible(circle, user, member) && attendanceEligible(circle, activity, user) &&
      !await hasRosterBlock(tx, this.activityAudience(circle, activity, user.id));
  }

  private async blockLookup(ids: string[]) {
    const users = [...new Set(ids)];
    const blocks = await this.prisma.block.findMany({
      where: { deletedAt: null, blockerId: { in: users }, blockedId: { in: users } },
      select: { blockerId: true, blockedId: true },
    });
    const pairs = new Set(blocks.map(({ blockerId, blockedId }) => mediaPairKey(blockerId, blockedId)));
    return (group: string[]) => group.some((id, index) =>
      group.slice(index + 1).some((peer) => pairs.has(mediaPairKey(id, peer))));
  }

  private async lockPairs(tx: PrismaTransactionalClient, userId: string, others: string[]) {
    const keys = [...new Set(others.filter((id) => id !== userId).map((id) => mediaPairKey(userId, id)))].sort();
    for (const key of keys) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }

  private assertOrganizer(circle: Circle, userId: string) {
    if (circle.organizerId !== userId) unavailable();
  }

  private assertOpen(circle: Circle) {
    if (circleState(circle) !== "OPEN") conflict("This circle is no longer open");
  }

  private async activityData(tx: PrismaTransactionalClient, circle: Circle, input: ActivityContentDto) {
    if (input.venueId && !await tx.reviewedVenue.findFirst({
      where: { ...reviewedVenue, id: input.venueId, city: { equals: circle.city, mode: "insensitive" }, countryCode: circle.countryCode },
      select: { id: true },
    })) conflict("Choose a reviewed public venue in this city");
    const startsAt = input.startsAt ? new Date(input.startsAt) : null;
    if (startsAt && (startsAt <= new Date() || startsAt > circle.expiresAt)) {
      conflict("Schedule the activity before this circle expires");
    }
    return {
      title: input.title, description: input.description, venueId: input.venueId ?? null, startsAt,
      expiresAt: startsAt ?? new Date(Math.min(circle.expiresAt.getTime(), Date.now() + 7 * DAY_MS)),
      capacity: input.capacity, openToNearby: input.openToNearby,
    };
  }

  private locality(user: SocialUser) {
    const { city, region, countryCode } = user.profile!;
    return city && region && countryCode ? {
      city: { equals: city, mode: "insensitive" as const }, region: { equals: region, mode: "insensitive" as const },
      countryCode: { equals: countryCode, mode: "insensitive" as const },
    } : null;
  }

  private memberLabel(user: SocialUser) {
    return { userId: user.id, name: isPublic(user.profile) ? user.profile?.displayName ?? "Circle member" : "Circle member" };
  }

  private circleSummary(circle: Circle, userId: string, ownStatus: CircleRequestStatus | null, activeMatch: boolean) {
    const state = circleState(circle);
    const organizer = circle.organizerId === userId;
    const showLocality = organizer || canViewProfileField(circle.organizer.profile, "location", activeMatch);
    return {
      id: circle.id, title: circle.title, description: circle.description, intent: circle.intent,
      locality: showLocality ? `${circle.city}, ${circle.region}` : "", capacity: circle.capacity, approvedCount: circle.memberships.length,
      state: state === "OPEN" && circle.memberships.length >= circle.capacity ? "FULL" as const : state,
      organizer, ownStatus, redacted: false,
    };
  }

  private activitySummary(circle: Circle, activity: Activity, mine: { need: number; status: CircleRequestStatus }[], member: boolean) {
    const state = activityState(circle, activity);
    const venue = activity.venue;
    return {
      id: activity.id, title: activity.title, description: activity.description,
      venue: venue && venue.reviewStatus === "REVIEWED" && venue.operationalStatus !== "CLOSED" && !venue.deletedAt && !venue.isSynthetic
        ? { id: venue.id, name: venue.name, publicLocality: venue.publicLocality } : null,
      startsAt: activity.startsAt?.toISOString() ?? null, capacity: activity.capacity, helpNeeds: member ? activity.helpNeeds : [],
      openToNearby: activity.openToNearby, approvedCount: activity.responses.length, mine, version: activity.version, redacted: false,
      state: state === "OPEN" && activity.responses.length >= activity.capacity ? "FULL" as const : state,
    };
  }

  private unavailableActivity(id: string, mine: { need: number; status: CircleRequestStatus }[], state: string) {
    return {
      id, title: "Unavailable activity", description: "", startsAt: null, venue: null,
      openToNearby: false, helpNeeds: [], redacted: true,
      state: state === "CANCELLED" || state === "CLOSED" || state === "EXPIRED" ? state : "UNAVAILABLE" as const,
      capacity: 0, approvedCount: 0, version: 0, mine,
    };
  }

  private async rotateChat(tx: PrismaTransactionalClient, circleId: string, memberIds: string[]) {
    await tx.conversation.updateMany({
      where: { circleId, status: "ACTIVE" }, data: { status: "CLOSED_UNMATCHED", closedAt: new Date() },
    });
    if (!memberIds.length) return;
    const grants = await tx.circleMembership.findMany({
      where: { circleId, status: "APPROVED", userId: { in: memberIds } },
      select: { userId: true, chatGrantId: true },
    });
    await tx.conversation.create({ data: {
      circleId, members: { create: grants.map(({ userId, chatGrantId }) => ({ userId, circleChatGrantId: chatGrantId })) },
      reads: { create: memberIds.map((userId) => ({ userId })) },
    } });
  }
}
