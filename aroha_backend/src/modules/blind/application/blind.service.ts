import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AppException } from "../../../common/errors/app.exception";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { BlindEventOccurrence, BlindRelationship, Prisma } from "../../../generated/prisma/client";
import { mediaPairKey } from "../../../integrations/object-storage/media-disclosure.service";
import { EvaluateFeatureFlagService } from "../../feature-flags/application/feature-flags.services";
import { CreateNotificationService } from "../../notifications/application/notifications.services";
import { BLIND_POLICY, effectiveEventState, nextThursday } from "../domain/blind-policy";
import { CreateMatchArtifactsService } from "../../matches/application/matches.services";
import { haversineDistanceKm } from "../../../common/utils/distance.util";
import type { JoinBlindEventDto, ScheduleBlindEventDto } from "../dto/blind.dto";

const eligibleUserInclude = { profile: true, discoveryPreference: true } satisfies Prisma.UserInclude;
type Participant = Prisma.UserGetPayload<{ include: typeof eligibleUserInclude }>;

@Injectable()
export class BlindService {
  constructor(private readonly prisma: PrismaService, private readonly flags: EvaluateFeatureFlagService, private readonly notifications: CreateNotificationService, private readonly matchArtifacts: CreateMatchArtifactsService) {}

  async capabilities(userId: string) {
    return { enabled: (await this.flags.execute({ key: "blind.v1", userId })).enabled };
  }
  private async enabled(userId: string) { if (!(await this.capabilities(userId)).enabled) this.unavailable("Blind Vibe is not available yet"); }
  private unavailable(message: string): never { throw new AppException(409, ERROR_CODES.VALIDATION_FAILED, message); }

  async ensureOccurrence(now = new Date()) {
    const window = nextThursday(now, Number(process.env.BLIND_EVENT_WEEKDAY ?? 4), Number(process.env.BLIND_EVENT_START_HOUR_IST ?? 20), Number(process.env.BLIND_EVENT_DURATION_MINUTES ?? 120));
    return this.prisma.blindEventOccurrence.upsert({ where: { occurrenceKey: `thursday:${window.startsAt.toISOString()}` }, create: { occurrenceKey: `thursday:${window.startsAt.toISOString()}`, ...window }, update: {} });
  }
  async current(userId: string) {
    await this.enabled(userId);
    const scheduled = await this.ensureOccurrence();
    // An authorized operations override takes priority during its own window.
    const event = await this.prisma.blindEventOccurrence.findFirst({ where: { startsAt: { lte: new Date() }, endsAt: { gt: new Date() } }, orderBy: { startsAt: "desc" } }) ?? scheduled;
    return this.event(userId, event.id);
  }
  async event(userId: string, id: string) {
    await this.enabled(userId);
    const event = await this.requiredEvent(id);
    const membership = await this.prisma.blindEventEnrollment.findUnique({ where: { occurrenceId_userId: { occurrenceId: id, userId } } });
    const relationships = await this.prisma.blindRelationship.findMany({ where: { occurrenceId: id, OR: [{ userLowId: userId }, { userHighId: userId }] }, select: { matchId: true } });
    const matches = await this.prisma.match.findMany({ where: { id: { in: relationships.map(r => r.matchId) }, status: "ACTIVE" }, include: { conversation: { select: { id: true } }, userLow: { select: { profile: { select: { displayName: true } } } }, userHigh: { select: { profile: { select: { displayName: true } } } } } });
    return { occurrence: this.eventDto(event), enrollment: membership ? { intent: membership.intent, notificationsEnabled: membership.notificationsEnabled, state: membership.leftAt ? "LEFT" : "JOINED" } : null,
      matches: matches.filter(m => m.conversation).map(m => ({ conversationId: m.conversation!.id, displayName: (m.userLowId === userId ? m.userHigh : m.userLow).profile?.displayName ?? "Yariva member" })) };
  }
  private eventDto(event: BlindEventOccurrence) { return { id: event.id, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt.toISOString(), timezone: "Asia/Kolkata", state: effectiveEventState(event), city: event.city }; }
  private async requiredEvent(id: string, tx: PrismaTransactionalClient = this.prisma) {
    const event = await tx.blindEventOccurrence.findUnique({ where: { id } });
    if (!event) throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Event not found");
    return event;
  }
  private async lockEvent(id: string, tx: PrismaTransactionalClient) {
    await tx.$executeRaw`SELECT id FROM "BlindEventOccurrence" WHERE id=${id}::uuid FOR UPDATE`;
    return this.requiredEvent(id, tx);
  }
  private async eligibleUser(userId: string, event: BlindEventOccurrence, tx: PrismaTransactionalClient) {
    const user = await tx.user.findUnique({ where: { id: userId }, include: eligibleUserInclude });
    const p = user?.profile;
    if (!user || user.status !== "ACTIVE" || user.deletedAt || user.isShadowBanned || user.isDiscoveryFrozen || user.isChatFrozen || !p || !p.isComplete || p.isHidden || p.isIncognito || p.isPaused || p.deletedAt || !p.dateOfBirth || age(p.dateOfBirth) < 18 || p.city?.toLowerCase() !== event.city.toLowerCase()) return null;
    return user;
  }
  async join(userId: string, occurrenceId: string, payload: JoinBlindEventDto) {
    await this.enabled(userId);
    await this.prisma.$transaction(async tx => {
      const event = await this.lockEvent(occurrenceId, tx);
      if (!["UPCOMING", "LIVE"].includes(effectiveEventState(event))) this.unavailable("This event has ended");
      if (!(await this.eligibleUser(userId, event, tx))) this.unavailable("This pilot needs an eligible adult profile in the event city");
      const prior = await tx.blindEventEnrollment.findUnique({ where: { occurrenceId_userId: { occurrenceId, userId } } });
      if (prior && !prior.leftAt && prior.intent !== payload.intent) this.unavailable("Leave before changing your event intent");
      await tx.blindEventEnrollment.upsert({ where: { occurrenceId_userId: { occurrenceId, userId } }, create: { occurrenceId, userId, intent: payload.intent, notificationsEnabled: payload.notificationsEnabled }, update: { intent: payload.intent, notificationsEnabled: payload.notificationsEnabled, leftAt: null } });
    });
    return this.event(userId, occurrenceId);
  }
  async leave(userId: string, occurrenceId: string) {
    await this.prisma.$transaction(async tx => {
      await this.lockEvent(occurrenceId, tx);
      await tx.blindEventEnrollment.updateMany({ where: { occurrenceId, userId }, data: { leftAt: new Date(), notificationsEnabled: false } });
      await tx.blindEventInterest.deleteMany({ where: { occurrenceId, OR: [{ actorId: userId }, { targetId: userId }] } });
    });
    return this.event(userId, occurrenceId);
  }
  private async eligiblePair(a: Participant, b: Participant, tx: PrismaTransactionalClient) {
    const rollout = await tx.blindRollout.findUniqueOrThrow({ where: { id: 1 } });
    // For two legacy accounts we cannot prove that neither cached a photo
    // before exposure tracking existed. One new account makes history complete.
    if (a.createdAt < rollout.exposureTrackingStartedAt && b.createdAt < rollout.exposureTrackingStartedAt) return false;
    for (const [viewer, other] of [[a, b], [b, a]] as const) {
      const pref = viewer.discoveryPreference;
      const years = age(other.profile!.dateOfBirth!);
      if (pref && (years < (pref.minAge ?? 18) || years > (pref.maxAge ?? 100) || (pref.preferredGenders.length > 0 && !pref.preferredGenders.includes(other.profile!.gender!)))) return false;
    }
    const ap = a.profile!, bp = b.profile!;
    if (ap.locationLat === null || ap.locationLng === null || bp.locationLat === null || bp.locationLng === null) return false;
    const km = haversineDistanceKm(Number(ap.locationLat), Number(ap.locationLng), Number(bp.locationLat), Number(bp.locationLng));
    if (!Number.isFinite(km) || km > Math.min(a.discoveryPreference?.maxDistanceKm ?? 15, b.discoveryPreference?.maxDistanceKm ?? 15)) return false;
    const [low, high] = [a.id, b.id].sort() as [string, string];
    if (await tx.match.findUnique({ where: { userLowId_userHighId: { userLowId: low, userHighId: high } } })) return false;
    const blocked = await tx.block.count({ where: { deletedAt: null, OR: [{ blockerId: a.id, blockedId: b.id }, { blockerId: b.id, blockedId: a.id }] } });
    if (blocked) return false;
    return (await tx.mediaExposure.count({ where: { OR: [{ viewerId: a.id, ownerId: b.id }, { viewerId: b.id, ownerId: a.id }] } })) === 0;
  }
  private async activeEnrollment(userId: string, occurrenceId: string, tx: PrismaTransactionalClient) {
    const entry = await tx.blindEventEnrollment.findUnique({ where: { occurrenceId_userId: { occurrenceId, userId } } });
    if (!entry || entry.leftAt) this.unavailable("Join this event first");
    return entry;
  }
  async candidates(userId: string, occurrenceId: string) {
    await this.enabled(userId);
    const event = await this.requiredEvent(occurrenceId);
    if (effectiveEventState(event) !== "LIVE") return { items: [] };
    const entry = await this.activeEnrollment(userId, occurrenceId, this.prisma);
    const viewer = await this.eligibleUser(userId, event, this.prisma);
    if (!viewer) this.unavailable("Your profile is not eligible for this event");
    const entries = await this.prisma.blindEventEnrollment.findMany({ where: { occurrenceId, intent: entry.intent, leftAt: null, userId: { not: userId } }, take: 50, orderBy: { joinedAt: "asc" } });
    const items: Array<{ userId: string; displayName: string; headline: string | null; interestSent: boolean }> = [];
    for (const candidate of entries) {
      const other = await this.eligibleUser(candidate.userId, event, this.prisma);
      if (!other || !(await this.capabilities(other.id)).enabled || !(await this.eligiblePair(viewer, other, this.prisma))) continue;
      const interest = await this.prisma.blindEventInterest.findUnique({ where: { occurrenceId_actorId_targetId: { occurrenceId, actorId: userId, targetId: other.id } } });
      items.push({ userId: other.id, displayName: other.profile!.displayName ?? "Yariva member", headline: other.profile!.headline, interestSent: Boolean(interest) });
    }
    return { items };
  }
  async interest(userId: string, occurrenceId: string, targetId: string) {
    await this.enabled(userId); await this.enabled(targetId);
    if (userId === targetId) this.unavailable("Choose another participant");
    const [userLowId, userHighId] = [userId, targetId].sort() as [string, string];
    return this.prisma.$transaction(async tx => {
      const event = await this.lockEvent(occurrenceId, tx);
      if (effectiveEventState(event) !== "LIVE") this.unavailable("Introductions are closed for this event");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${mediaPairKey(userId, targetId)}, 0))`;
      const [entry, targetEntry] = await Promise.all([this.activeEnrollment(userId, occurrenceId, tx), this.activeEnrollment(targetId, occurrenceId, tx)]);
      if (entry.intent !== targetEntry.intent) this.unavailable("This introduction is no longer eligible");
      const a = await this.eligibleUser(userId, event, tx); const b = await this.eligibleUser(targetId, event, tx);
      if (!a || !b) this.unavailable("This introduction is no longer eligible");
      const existing = await tx.blindRelationship.findUnique({ where: { userLowId_userHighId: { userLowId, userHighId } } });
      if (existing?.occurrenceId === occurrenceId) {
        const match = await tx.match.findUnique({ where: { id: existing.matchId }, include: { conversation: true } });
        if (match?.status === "ACTIVE") return { state: "MATCHED", conversationId: match.conversation?.id ?? null };
      }
      if (!(await this.eligiblePair(a, b, tx))) this.unavailable("This introduction is no longer eligible");
      await tx.blindEventInterest.upsert({ where: { occurrenceId_actorId_targetId: { occurrenceId, actorId: userId, targetId } }, create: { occurrenceId, actorId: userId, targetId }, update: {} });
      const mutual = await tx.blindEventInterest.findUnique({ where: { occurrenceId_actorId_targetId: { occurrenceId, actorId: targetId, targetId: userId } } });
      if (!mutual) return { state: "WAITING", conversationId: null };
      const { match, conversationId } = await this.matchArtifacts.execute(tx, { actorId: userId, targetId, matchedAt: new Date() });
      await tx.blindRelationship.create({ data: { matchId: match.id, userLowId, userHighId, occurrenceId, perParticipantTarget: BLIND_POLICY.perParticipantTarget, initialBlurRadius: BLIND_POLICY.initialBlurRadius } });
      return { state: "MATCHED", conversationId };
    });
  }
  async relationship(userId: string, matchId: string) {
    const match = await this.prisma.match.findFirst({ where: { id: matchId, status: "ACTIVE", OR: [{ userLowId: userId }, { userHighId: userId }] } });
    if (!match) throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Relationship unavailable");
    const relationship = await this.prisma.blindRelationship.findUnique({ where: { matchId } });
    return { blind: relationship ? this.relationshipDto(relationship, userId) : null };
  }
  private relationshipDto(r: BlindRelationship, userId: string) {
    return { isBlindVibeActive: !r.revealedAt, interactionCount: r.lowCount + r.highCount, myCount: userId === r.userLowId ? r.lowCount : r.highCount, perParticipantTarget: r.perParticipantTarget, revealThreshold: r.perParticipantTarget * 2, initialBlurRadius: r.initialBlurRadius, myRevealConsent: userId === r.userLowId ? r.lowRevealConsent : r.highRevealConsent, otherRevealConsent: userId === r.userLowId ? r.highRevealConsent : r.lowRevealConsent, revealedAt: r.revealedAt?.toISOString() ?? null };
  }
  async requestReveal(userId: string, matchId: string) {
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT id FROM "Match" WHERE id=${matchId}::uuid FOR UPDATE`;
      const match = await tx.match.findFirst({ where: { id: matchId, status: "ACTIVE", OR: [{ userLowId: userId }, { userHighId: userId }] } });
      if (!match) throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Relationship unavailable");
      await tx.$executeRaw`SELECT "matchId" FROM "BlindRelationship" WHERE "matchId"=${matchId}::uuid FOR UPDATE`;
      const r = await tx.blindRelationship.findUnique({ where: { matchId } });
      if (!r) this.unavailable("This is not a blind introduction");
      const updated = await tx.blindRelationship.update({ where: { matchId }, data: userId === r.userLowId ? { lowRevealConsent: true } : { highRevealConsent: true } });
      if (!updated.revealedAt && updated.lowRevealConsent && updated.highRevealConsent) await tx.blindRelationship.update({ where: { matchId }, data: { revealedAt: new Date() } });
    });
    return this.relationship(userId, matchId);
  }
  async schedule(payload: ScheduleBlindEventDto) {
    const startsAt = new Date(payload.startsAt), endsAt = new Date(payload.endsAt);
    if (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 4 * 3600_000 || !payload.city.trim()) this.unavailable("Choose an ordered event window of at most four hours");
    return this.prisma.blindEventOccurrence.create({ data: { occurrenceKey: `ops:${randomUUID()}`, startsAt, endsAt, city: payload.city.trim() } });
  }
  async cancel(id: string) { return this.prisma.blindEventOccurrence.update({ where: { id }, data: { cancelledAt: new Date(), state: "CANCELLED" } }); }

  async reconcile() {
    await this.ensureOccurrence();
    const events = await this.prisma.blindEventOccurrence.findMany({ where: { endsAt: { gte: new Date(Date.now() - 7 * 86400000) } } });
    for (const event of events) {
      const state = effectiveEventState(event);
      await this.prisma.blindEventOccurrence.update({ where: { id: event.id }, data: { state } });
      if (!["LIVE", "CANCELLED", "ENDED"].includes(state)) continue;
      const entries = await this.prisma.blindEventEnrollment.findMany({ where: { occurrenceId: event.id, notificationsEnabled: true, leftAt: null } });
      for (const entry of entries) {
        if (!(await this.capabilities(entry.userId)).enabled) continue;
        await this.notifications.execute({ userId: entry.userId, type: "SYSTEM", title: state === "LIVE" ? "Blind Vibe is open" : state === "CANCELLED" ? "Blind Vibe cancelled" : "Blind Vibe has ended", body: state === "LIVE" ? "Meet someone through conversation first." : "Your existing chats stay available.", data: { blindOccurrenceId: event.id }, dedupeKey: `blind:${event.id}:${state}:${entry.userId}` });
        const relationships = await this.prisma.blindRelationship.findMany({ where: { occurrenceId: event.id, OR: [{ userLowId: entry.userId }, { userHighId: entry.userId }] } });
        for (const r of relationships) {
          const match = await this.prisma.match.findFirst({ where: { id: r.matchId, status: "ACTIVE" }, include: { conversation: true } });
          if (match?.conversation) await this.notifications.execute({ userId: entry.userId, type: "NEW_MATCH", title: "A new Blind Vibe connection", body: "You both chose to connect. Say hello.", data: { matchId: r.matchId, conversationId: match.conversation.id }, dedupeKey: `blind-match:${r.matchId}:${entry.userId}` });
        }
      }
    }
  }
}
function age(date: Date) { const now = new Date(); return now.getUTCFullYear() - date.getUTCFullYear() - (now.getUTCMonth() < date.getUTCMonth() || (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate()) ? 1 : 0); }
