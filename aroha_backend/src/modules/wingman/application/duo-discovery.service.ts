import { ensureDuoConversation } from "../../conversations/infrastructure/conversations.infrastructure";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { openPrivateCursor, sealPrivateCursor } from "../../../common/utils/private-cursor.util";
import authConfig from "../../../config/auth.config";
import wingmanConfig from "../../../config/wingman.config";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import { Prisma } from "../../../generated/prisma/client";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import { EvaluateFeatureFlagService } from "../../feature-flags/application/feature-flags.services";
import { CreateNotificationService } from "../../notifications/application/notifications.services";
import { canViewProfileField } from "../../profiles/domain/profile-field-audience";
import type {
  DuoCandidateDto,
  DuoDiscoveryMemberDto,
  DuoDiscoveryPageDto,
  DuoPairMatchDto,
  DuoVoteResponseDto,
} from "../dto/duo-discovery.dto";
import { DuoDiscoveryCache } from "../infrastructure/duo-discovery.cache";

const discoveryPartyInclude = {
  members: {
    include: {
      consentedScene: { include: { photo: true } },
      user: {
        select: {
          id: true,
          status: true,
          deletedAt: true,
          isShadowBanned: true,
          isDiscoveryFrozen: true,
          profile: true,
          discoveryPreference: true,
          photos: {
            where: {
              moderationStatus: "APPROVED" as const,
              purpose: "PROFILE" as const,
              deletedAt: null,
            },
            orderBy: [{ isPrimary: "desc" as const }, { position: "asc" as const }],
            take: 1,
          },
        },
      },
    },
    orderBy: [{ role: "asc" as const }, { createdAt: "asc" as const }],
  },
} satisfies Prisma.WingmanPartyInclude;

type DiscoveryParty = Prisma.WingmanPartyGetPayload<{
  include: typeof discoveryPartyInclude;
}>;
type DiscoveryMember = DiscoveryParty["members"][number];

interface CandidateRow {
  partyId: string;
  maxDistanceMeters: number;
  createdAt: Date;
}

interface DiscoveryCursor {
  distanceMeters: number;
  createdAt: string;
  partyId: string;
}

interface CandidateContext {
  party: DiscoveryParty;
  distanceMeters: number;
  approvals: number;
}

@Injectable()
export class DuoDiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: EvaluateFeatureFlagService,
    private readonly objectStorage: ObjectStorageService,
    private readonly notifications: CreateNotificationService,
    private readonly audit: AuditLogService,
    private readonly cache: DuoDiscoveryCache,
    @Inject(wingmanConfig.KEY)
    private readonly config: ConfigType<typeof wingmanConfig>,
    @Inject(authConfig.KEY) private readonly auth: ConfigType<typeof authConfig>,
  ) {}

  async discover(input: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<DuoDiscoveryPageDto> {
    await this.assertEnabled(input.userId);
    const now = new Date();
    const source = await this.requireReadyPartyForUser(input.userId, now);
    const activeMatch = await this.findActiveMatch(source.party);
    if (activeMatch) {
      return {
        items: [],
        nextCursor: null,
        waiting: { targetCount: 0, state: "NONE" },
        match: await this.mapMatch(activeMatch.id, source.party.id, input.userId),
      };
    }

    const limit = Math.max(1, Math.min(input.limit ?? 10, 20));
    const scope = `duo:${input.userId}:${source.party.id}:${source.party.membershipVersion}`;
    const secret = this.auth.jwtAccessSecret;
    const cursor = decodeCursor(input.cursor, secret, scope);
    const generation = await this.cache.generation();
    const cacheKey = this.cache.key({
      viewerId: input.userId,
      partyId: source.party.id,
      membershipVersion: source.party.membershipVersion,
      sceneFingerprint: sceneFingerprint(source.party),
      generation,
      cursor: cursor ? JSON.stringify(cursor) : null,
      limit,
    });
    const cached = await this.cache.get(cacheKey);
    const waiting = await this.waitingSummary(source.party, input.userId, now);
    if (cached) {
      const candidates = await this.hydrateCandidates(
        source.party,
        input.userId,
        cached.items,
        now,
      );
      return {
        items: await Promise.all(candidates.map((item) => this.mapCandidate(item, input.userId))),
        nextCursor: cached.nextCursor ? sealPrivateCursor(cached.nextCursor, secret, scope) : null,
        waiting,
        match: null,
      };
    }

    const rows = await this.candidateRows({
      sourcePartyId: source.party.id,
      now,
      cursor,
      limit: 100,
    });
    const hydrated = await this.hydrateCandidates(
      source.party,
      input.userId,
      rows.map((row) => ({
        partyId: row.partyId,
        distanceMeters: row.maxDistanceMeters,
      })),
      now,
    );
    const page = hydrated.slice(0, limit);
    const hasMore = hydrated.length > limit || rows.length === 100;
    const last = page.at(-1);
    const rowForLast = last
      ? rows.find((row) => row.partyId === last.party.id)
      : rows.at(-1);
    const nextCursor =
      hasMore && rowForLast
        ? JSON.stringify({
            distanceMeters: rowForLast.maxDistanceMeters,
            createdAt: rowForLast.createdAt.toISOString(),
            partyId: rowForLast.partyId,
          })
        : null;
    await this.cache.set(
      cacheKey,
      {
        items: page.map((item) => ({
          partyId: item.party.id,
          distanceMeters: item.distanceMeters,
        })),
        nextCursor,
      },
      this.config.discoveryCacheSeconds,
    );
    return {
      items: await Promise.all(page.map((item) => this.mapCandidate(item, input.userId))),
      nextCursor: nextCursor ? sealPrivateCursor(nextCursor, secret, scope) : null,
      waiting,
      match: null,
    };
  }

  async vote(input: {
    userId: string;
    sessionId: string;
    targetPartyId: string;
    decision: "APPROVE" | "PASS";
  }): Promise<DuoVoteResponseDto> {
    await this.assertEnabled(input.userId);
    const now = new Date();
    const source = await this.requireReadyPartyForUser(input.userId, now);
    if (source.party.id === input.targetPartyId) {
      throw new AppException(
        400,
        ERROR_CODES.WINGMAN_VOTE_INVALID,
        "Choose another Duo",
      );
    }
    const target = await this.loadParty(input.targetPartyId);
    if (!(await this.isEligiblePair(source.party, target, now, this.prisma, true))) {
      this.throwTargetNotEligible();
    }

    let createdMatchId: string | null = null;
    let matchId: string | null = null;
    let outcome: DuoVoteResponseDto["outcome"] = "VOTE_RECORDED";
    let ownApprovalCount = 0;
    // A serializable snapshot can become stale while waiting for party locks.
    // Retry the entire transaction, never just its final insert or notification.
    for (let attempt = 0; ; attempt++) {
      createdMatchId = null;
      matchId = null;
      outcome = "VOTE_RECORDED";
      ownApprovalCount = 0;
      try {
    await this.prisma.$transaction(
      async (tx) => {
        for (const partyId of [source.party.id, target!.id].sort()) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${partyId}, 0))`;
        }
        const lockedSource = await this.loadParty(source.party.id, tx);
        const lockedTarget = await this.loadParty(target!.id, tx);
        if (!(await this.isEligiblePair(lockedSource, lockedTarget, now, tx, true))) {
          this.throwTargetNotEligible();
        }
        const voter = lockedSource!.members.find(
          (member) => member.userId === input.userId,
        );
        if (!voter?.consentedScene) {
          throw new AppException(
            409,
            ERROR_CODES.WINGMAN_DISCOVERY_NOT_READY,
            "Approve your current Scene before voting",
          );
        }
        const [targetOwner, targetBuddy] = orderedMembers(lockedTarget!);
        const recordedVote = await tx.wingmanPartyVote.upsert({
          where: {
            sourcePartyId_targetPartyId_voterUserId: {
              sourcePartyId: lockedSource!.id,
              targetPartyId: lockedTarget!.id,
              voterUserId: input.userId,
            },
          },
          create: {
            voterUserId: input.userId,
            sourcePartyId: lockedSource!.id,
            targetPartyId: lockedTarget!.id,
            decision: input.decision,
            sourceMembershipVersion: lockedSource!.membershipVersion,
            targetMembershipVersion: lockedTarget!.membershipVersion,
            sourceSceneId: voter.consentedScene.id,
            sourceSceneVersion: voter.consentedScene.version,
            targetOwnerSceneId: targetOwner.consentedScene!.id,
            targetOwnerSceneVersion: targetOwner.consentedScene!.version,
            targetBuddySceneId: targetBuddy.consentedScene!.id,
            targetBuddySceneVersion: targetBuddy.consentedScene!.version,
          },
          update: {
            decision: input.decision,
            sourceMembershipVersion: lockedSource!.membershipVersion,
            targetMembershipVersion: lockedTarget!.membershipVersion,
            sourceSceneId: voter.consentedScene.id,
            sourceSceneVersion: voter.consentedScene.version,
            targetOwnerSceneId: targetOwner.consentedScene!.id,
            targetOwnerSceneVersion: targetOwner.consentedScene!.version,
            targetBuddySceneId: targetBuddy.consentedScene!.id,
            targetBuddySceneVersion: targetBuddy.consentedScene!.version,
            pairMatchId: null,
            matchedAt: null,
          },
        });

        const approvals = await tx.wingmanPartyVote.findMany({
          where: {
            decision: "APPROVE",
            OR: [
              {
                sourcePartyId: lockedSource!.id,
                targetPartyId: lockedTarget!.id,
              },
              {
                sourcePartyId: lockedTarget!.id,
                targetPartyId: lockedSource!.id,
              },
            ],
          },
        });
        const valid = approvals.filter((vote) =>
          vote.sourcePartyId === lockedSource!.id
            ? voteIsCurrent(vote, lockedSource!, lockedTarget!)
            : voteIsCurrent(vote, lockedTarget!, lockedSource!),
        );
        ownApprovalCount = valid.filter(
          (vote) => vote.sourcePartyId === lockedSource!.id,
        ).length;
        const reverseApprovalCount = valid.filter(
          (vote) => vote.sourcePartyId === lockedTarget!.id,
        ).length;

        if (
          ownApprovalCount === lockedSource!.members.length &&
          reverseApprovalCount === lockedTarget!.members.length
        ) {
          const sortedPartyIds = [
            lockedSource!.id,
            lockedTarget!.id,
          ].sort();
          const partyLowId = sortedPartyIds[0]!;
          const partyHighId = sortedPartyIds[1]!;
          const existing = await tx.wingmanPairMatch.findUnique({
            where: { partyLowId_partyHighId: { partyLowId, partyHighId } },
          });
          if (existing) {
            matchId = existing.id;
            outcome = "PAIR_MATCH_EXISTS";
          } else {
            const activeElsewhere = await tx.wingmanPairMatch.findFirst({
              where: {
                status: "ACTIVE",
                OR: [
                  { partyLowId: { in: [partyLowId, partyHighId] } },
                  { partyHighId: { in: [partyLowId, partyHighId] } },
                ],
              },
            });
            if (activeElsewhere) this.throwTargetNotEligible();
            const lowParty =
              lockedSource!.id === partyLowId ? lockedSource! : lockedTarget!;
            const highParty =
              lockedSource!.id === partyHighId ? lockedSource! : lockedTarget!;
            const created = await tx.wingmanPairMatch.create({
              data: {
                partyLowId,
                partyHighId,
                partyLowMembershipVersion: lowParty.membershipVersion,
                partyHighMembershipVersion: highParty.membershipVersion,
              },
            });
            matchId = created.id;
            createdMatchId = created.id;
            await ensureDuoConversation(tx, created.id, [...lowParty.members, ...highParty.members].map((member) => member.userId));
            outcome = "PAIR_MATCH_CREATED";
          }
          await tx.wingmanPartyVote.updateMany({
            where: { id: { in: valid.map((vote) => vote.id) } },
            data: { pairMatchId: matchId, matchedAt: now },
          });
        }

        await this.audit.write(
          {
            actorUserId: input.userId,
            actorSessionId: input.sessionId,
            action: "duo.discovery.vote",
            entityType: "WingmanPartyVote",
            entityId: recordedVote.id,
            metadata: {
              sourcePartyId: lockedSource!.id,
              targetPartyId: lockedTarget!.id,
              decision: input.decision,
              pairMatchId: matchId,
            },
          },
          tx,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
        break;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt >= 4) throw error;
      }
    }

    if (createdMatchId) {
      await this.cache.bump().catch(() => undefined);
      const participantIds = [
        ...source.party.members.map((member) => member.userId),
        ...target!.members.map((member) => member.userId),
      ];
      await Promise.all(
        participantIds.map((userId) =>
          this.notifications
            .execute({
              userId,
              type: "SYSTEM",
              title: "It’s a Duo match",
              body: "Both Duos chose each other.",
              data: { route: "yariva://wingman", pairMatchId: createdMatchId },
              dedupeKey: `duo-pair-match:${createdMatchId}:${userId}`,
            })
            .catch(() => undefined),
        ),
      );
    }
    return {
      outcome,
      decision: input.decision,
      ownApprovalCount,
      ownMemberCount: source.party.members.length,
      match: matchId ? await this.mapMatch(matchId, source.party.id, input.userId) : null,
    };
  }

  private async candidateRows(input: {
    sourcePartyId: string;
    now: Date;
    cursor: DiscoveryCursor | null;
    limit: number;
  }): Promise<CandidateRow[]> {
    const locationFreshAfter = new Date(
      input.now.getTime() - this.config.locationMaxAgeHours * 60 * 60 * 1000,
    );
    const adultCutoff = new Date(input.now);
    adultCutoff.setUTCFullYear(adultCutoff.getUTCFullYear() - 18);
    const cursorCondition = input.cursor
      ? Prisma.sql`WHERE (
          e."maxDistanceMeters" > ${input.cursor.distanceMeters}
          OR (e."maxDistanceMeters" = ${input.cursor.distanceMeters} AND e."createdAt" < ${new Date(input.cursor.createdAt)})
          OR (e."maxDistanceMeters" = ${input.cursor.distanceMeters} AND e."createdAt" = ${new Date(input.cursor.createdAt)} AND e."partyId" > ${input.cursor.partyId}::uuid)
        )`
      : Prisma.empty;
    return this.prisma.$queryRaw<CandidateRow[]>(Prisma.sql`
      WITH source_members AS (
        SELECT m."userId"
        FROM "WingmanPartyMember" m
        WHERE m."partyId" = ${input.sourcePartyId}::uuid AND m."status" = 'ACTIVE'
      ), eligible AS (
        SELECT
          p."id" AS "partyId",
          p."createdAt" AS "createdAt",
          MAX(ST_Distance(sp."locationPoint", tp."locationPoint"))::float8 AS "maxDistanceMeters"
        FROM "WingmanParty" p
        JOIN "WingmanPartyMember" tm ON tm."partyId" = p."id" AND tm."status" = 'ACTIVE'
        JOIN "User" tu ON tu."id" = tm."userId"
        JOIN "UserProfile" tp ON tp."userId" = tm."userId"
        JOIN "Scene" ts ON ts."id" = tm."consentedSceneId"
          AND ts."version" = tm."consentedSceneVersion"
          AND ts."status" = 'ACTIVE'
          AND ts."expiresAt" > ${input.now}
        CROSS JOIN source_members sm
        JOIN "UserProfile" sp ON sp."userId" = sm."userId"
        LEFT JOIN "Block" b ON b."deletedAt" IS NULL AND (
          (b."blockerId" = sm."userId" AND b."blockedId" = tm."userId")
          OR (b."blockerId" = tm."userId" AND b."blockedId" = sm."userId")
        )
        WHERE p."status" = 'ACTIVE'
          AND p."id" <> ${input.sourcePartyId}::uuid
          AND tu."status" = 'ACTIVE'
          AND tu."deletedAt" IS NULL
          AND tu."isShadowBanned" = FALSE
          AND tu."isDiscoveryFrozen" = FALSE
          AND tp."deletedAt" IS NULL
          AND tp."isComplete" = TRUE
          AND tp."isHidden" = FALSE
          AND tp."isIncognito" = FALSE
          AND tp."isPaused" = FALSE
          AND tp."dateOfBirth" IS NOT NULL
          AND tp."dateOfBirth" <= ${adultCutoff}
          AND tp."locationPoint" IS NOT NULL
          AND tp."locationUpdatedAt" >= ${locationFreshAfter}
          AND sp."locationPoint" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "WingmanPairMatch" pm
            WHERE pm."status" = 'ACTIVE'
              AND (pm."partyLowId" = p."id" OR pm."partyHighId" = p."id")
          )
        GROUP BY p."id", p."createdAt"
        HAVING COUNT(DISTINCT tm."userId") = 2
          AND COUNT(b."id") = 0
          AND MAX(ST_Distance(sp."locationPoint", tp."locationPoint")) <= ${this.config.discoveryRadiusMeters}
      )
      SELECT e."partyId", e."createdAt", e."maxDistanceMeters"
      FROM eligible e
      ${cursorCondition}
      ORDER BY e."maxDistanceMeters" ASC, e."createdAt" DESC, e."partyId" ASC
      LIMIT ${input.limit}
    `);
  }

  private async hydrateCandidates(
    source: DiscoveryParty,
    viewerId: string,
    items: Array<{ partyId: string; distanceMeters: number }>,
    now: Date,
  ): Promise<CandidateContext[]> {
    if (!items.length) return [];
    const partyIds = items.map((item) => item.partyId);
    const [parties, votes] = await Promise.all([
      this.prisma.wingmanParty.findMany({
        where: { id: { in: partyIds } },
        include: discoveryPartyInclude,
      }),
      this.prisma.wingmanPartyVote.findMany({
        where: {
          sourcePartyId: source.id,
          targetPartyId: { in: partyIds },
        },
      }),
    ]);
    const byId = new Map(parties.map((party) => [party.id, party]));
    const result: CandidateContext[] = [];
    for (const item of items) {
      const party = byId.get(item.partyId);
      if (!party || !(await this.isEligiblePair(source, party, now))) continue;
      const currentVotes = votes.filter(
        (vote) =>
          vote.targetPartyId === party.id && voteIsCurrent(vote, source, party),
      );
      if (currentVotes.some((vote) => vote.voterUserId === viewerId)) continue;
      result.push({
        party,
        distanceMeters: item.distanceMeters,
        approvals: currentVotes.filter((vote) => vote.decision === "APPROVE").length,
      });
    }
    return result;
  }

  private async waitingSummary(
    source: DiscoveryParty,
    viewerId: string,
    now: Date,
  ): Promise<DuoDiscoveryPageDto["waiting"]> {
    const viewerApprovals = await this.prisma.wingmanPartyVote.findMany({
      where: {
        voterUserId: viewerId,
        sourcePartyId: source.id,
        decision: "APPROVE",
        pairMatchId: null,
      },
    });
    if (!viewerApprovals.length) return { targetCount: 0, state: "NONE" };
    const targetIds = [...new Set(viewerApprovals.map((vote) => vote.targetPartyId))];
    const targets = await this.prisma.wingmanParty.findMany({
      where: { id: { in: targetIds } },
      include: discoveryPartyInclude,
    });
    let targetCount = 0;
    let waitingForOther = false;
    for (const target of targets) {
      if (!(await this.isEligiblePair(source, target, now))) continue;
      const votes = await this.prisma.wingmanPartyVote.findMany({
        where: {
          sourcePartyId: source.id,
          targetPartyId: target.id,
          decision: "APPROVE",
        },
      });
      const count = votes.filter((vote) => voteIsCurrent(vote, source, target)).length;
      if (!count) continue;
      targetCount += 1;
      if (count === source.members.length) waitingForOther = true;
    }
    return {
      targetCount,
      state: targetCount
        ? waitingForOther
          ? "WAITING_FOR_OTHER_DUO"
          : "WAITING_FOR_YOUR_DUO"
        : "NONE",
    };
  }

  private async isEligiblePair(
    source: DiscoveryParty | null,
    target: DiscoveryParty | null,
    now: Date,
    executor: PrismaTransactionalClient = this.prisma,
    allowExistingPair = false,
  ): Promise<boolean> {
    if (!source || !target || source.id === target.id) return false;
    if (!partyIsReady(source, now, this.config.locationMaxAgeHours)) return false;
    if (!partyIsReady(target, now, this.config.locationMaxAgeHours)) return false;
    const sourceIds = source.members.map((member) => member.userId);
    const targetIds = target.members.map((member) => member.userId);
    const blockCount = await executor.block.count({
      where: {
        deletedAt: null,
        OR: [
          { blockerId: { in: sourceIds }, blockedId: { in: targetIds } },
          { blockerId: { in: targetIds }, blockedId: { in: sourceIds } },
        ],
      },
    });
    if (blockCount) return false;
    const activeMatch = await executor.wingmanPairMatch.findFirst({
      where: {
        status: "ACTIVE",
        OR: [
          { partyLowId: { in: [source.id, target.id] } },
          { partyHighId: { in: [source.id, target.id] } },
        ],
      },
    });
    if (activeMatch && !(allowExistingPair && [source.id, target.id].includes(activeMatch.partyLowId) && [source.id, target.id].includes(activeMatch.partyHighId))) return false;
    if (maxCrossDistanceMeters(source, target) > this.config.discoveryRadiusMeters) {
      return false;
    }
    return hasCompatibleCompletePairing(source, target, now);
  }

  private async requireReadyPartyForUser(userId: string, now: Date) {
    const membership = await this.prisma.wingmanPartyMember.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        party: { status: "ACTIVE" },
      },
      include: { party: { include: discoveryPartyInclude } },
    });
    if (
      !membership ||
      !partyIsReady(
        membership.party,
        now,
        this.config.locationMaxAgeHours,
      )
    ) {
      throw new AppException(
        409,
        ERROR_CODES.WINGMAN_DISCOVERY_NOT_READY,
        "Both Duo members must approve their current Scenes first",
      );
    }
    return { membership, party: membership.party };
  }

  private loadParty(
    partyId: string,
    executor: PrismaTransactionalClient = this.prisma,
  ): Promise<DiscoveryParty | null> {
    return executor.wingmanParty.findUnique({
      where: { id: partyId },
      include: discoveryPartyInclude,
    });
  }

  private async findActiveMatch(party: DiscoveryParty) {
    const match = await this.prisma.wingmanPairMatch.findFirst({
      where: {
        status: "ACTIVE",
        OR: [{ partyLowId: party.id }, { partyHighId: party.id }],
      },
    });
    if (!match) return null;
    const expectedVersion =
      match.partyLowId === party.id
        ? match.partyLowMembershipVersion
        : match.partyHighMembershipVersion;
    if (expectedVersion === party.membershipVersion) return match;
    await this.prisma.wingmanPairMatch.update({
      where: { id: match.id },
      data: { status: "ENDED", endedAt: new Date() },
    });
    await this.cache.bump().catch(() => undefined);
    return null;
  }

  private async mapCandidate(input: CandidateContext, viewerId: string): Promise<DuoCandidateDto> {
    return {
      partyId: input.party.id,
      membershipVersion: input.party.membershipVersion,
      members: await Promise.all(input.party.members.map((member) => this.mapMember(member, viewerId))),
      distance: input.party.members.every((member) => canViewProfileField(member.user.profile, "distance"))
        ? distanceSummary(input.distanceMeters) : { roundedKm: null, band: null },
      ownApprovalCount: input.approvals,
      ownMemberCount: 2,
    };
  }

  private async mapMatch(matchId: string, sourcePartyId: string, viewerId: string): Promise<DuoPairMatchDto> {
    const match = await this.prisma.wingmanPairMatch.findUnique({
      where: { id: matchId },
    });
    if (!match) {
      throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Duo match not found");
    }
    const otherPartyId =
      match.partyLowId === sourcePartyId ? match.partyHighId : match.partyLowId;
    const other = await this.loadParty(otherPartyId);
    if (!other) {
      throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Duo match not found");
    }
    return {
      id: match.id,
      conversationId: (await this.prisma.conversation.findUnique({ where: { duoMatchId: match.id }, select: { id: true } }))?.id ?? null,
      matchedAt: match.matchedAt.toISOString(),
      otherDuo: {
        partyId: other.id,
        members: await Promise.all(other.members.map((member) => this.mapMember(member, viewerId))),
      },
    };
  }

  private async mapMember(member: DiscoveryMember, viewerId: string): Promise<DuoDiscoveryMemberDto> {
    const profilePhoto = member.user.photos[0] ?? null;
    const scene = member.consentedScene!;
    const profile = member.user.profile;
    return {
      userId: member.userId,
      displayName: profile?.displayName?.trim() || "Yariva member",
      age: profile?.dateOfBirth && canViewProfileField(profile, "age") ? calculateAge(profile.dateOfBirth, new Date()) : null,
      photoUrl: profilePhoto
        ? await this.objectStorage.createPresignedGetObject({
            disclosure: { viewerId, ownerId: member.userId },
            bucket: profilePhoto.bucket,
            objectKey: profilePhoto.objectKey,
          })
        : null,
      scene: {
        id: scene.id,
        version: scene.version,
        intent: scene.intent,
        activity: scene.activity,
        photoUrl: scene.photo
          ? await this.objectStorage.createPresignedGetObject({
              disclosure: { viewerId, ownerId: member.userId },
              bucket: scene.photo.bucket,
              objectKey: scene.photo.objectKey,
            })
          : null,
        expiresAt: scene.expiresAt.toISOString(),
      },
    };
  }

  private async assertEnabled(userId: string): Promise<void> {
    const flag = await this.flags.execute({ key: "wingman.v1", userId });
    if (!flag.enabled) {
      throw new AppException(
        404,
        ERROR_CODES.WINGMAN_NOT_AVAILABLE,
        "Duo is not available",
      );
    }
  }

  private throwTargetNotEligible(): never {
    throw new AppException(
      409,
      ERROR_CODES.WINGMAN_TARGET_NOT_ELIGIBLE,
      "This Duo is no longer available",
    );
  }
}

export function partyIsReady(
  party: DiscoveryParty,
  now: Date,
  locationMaxAgeHours: number,
): boolean {
  if (party.status !== "ACTIVE" || party.members.length !== 2) return false;
  const adultCutoff = new Date(now);
  adultCutoff.setUTCFullYear(adultCutoff.getUTCFullYear() - 18);
  const locationCutoff = new Date(
    now.getTime() - locationMaxAgeHours * 60 * 60 * 1000,
  );
  return party.members.every((member) => {
    const user = member.user;
    const profile = user.profile;
    const scene = member.consentedScene;
    return Boolean(
      member.status === "ACTIVE" &&
        user.status === "ACTIVE" &&
        !user.deletedAt &&
        !user.isShadowBanned &&
        !user.isDiscoveryFrozen &&
        profile?.isComplete &&
        !profile.deletedAt &&
        !profile.isHidden &&
        !profile.isIncognito &&
        !profile.isPaused &&
        profile.dateOfBirth &&
        profile.dateOfBirth <= adultCutoff &&
        profile.locationLat !== null &&
        profile.locationLng !== null &&
        profile.locationUpdatedAt &&
        profile.locationUpdatedAt >= locationCutoff &&
        scene &&
        scene.status === "ACTIVE" &&
        scene.expiresAt > now &&
        scene.id === member.consentedSceneId &&
        scene.version === member.consentedSceneVersion,
    );
  });
}

export function voteIsCurrent(
  vote: {
    voterUserId: string;
    sourceMembershipVersion: number;
    targetMembershipVersion: number;
    sourceSceneId: string;
    sourceSceneVersion: number;
    targetOwnerSceneId: string;
    targetOwnerSceneVersion: number;
    targetBuddySceneId: string;
    targetBuddySceneVersion: number;
  },
  source: DiscoveryParty,
  target: DiscoveryParty,
): boolean {
  const voter = source.members.find((member) => member.userId === vote.voterUserId);
  const [owner, buddy] = orderedMembers(target);
  return Boolean(
    voter?.consentedScene &&
      vote.sourceMembershipVersion === source.membershipVersion &&
      vote.targetMembershipVersion === target.membershipVersion &&
      vote.sourceSceneId === voter.consentedScene.id &&
      vote.sourceSceneVersion === voter.consentedScene.version &&
      vote.targetOwnerSceneId === owner.consentedScene?.id &&
      vote.targetOwnerSceneVersion === owner.consentedScene?.version &&
      vote.targetBuddySceneId === buddy.consentedScene?.id &&
      vote.targetBuddySceneVersion === buddy.consentedScene?.version,
  );
}

function orderedMembers(party: DiscoveryParty): [DiscoveryMember, DiscoveryMember] {
  const owner = party.members.find((member) => member.role === "OWNER");
  const buddy = party.members.find((member) => member.role === "BUDDY");
  if (!owner || !buddy) {
    throw new AppException(
      409,
      ERROR_CODES.WINGMAN_DISCOVERY_NOT_READY,
      "This Duo is not ready",
    );
  }
  return [owner, buddy];
}

function sceneFingerprint(party: DiscoveryParty): string {
  return party.members
    .map((member) => `${member.consentedSceneId}.${member.consentedSceneVersion}`)
    .sort()
    .join("-");
}

export function hasCompatibleCompletePairing(
  source: DiscoveryParty,
  target: DiscoveryParty,
  now: Date,
): boolean {
  const [a, b] = orderedMembers(source);
  const [x, y] = orderedMembers(target);
  return (
    (membersCompatible(a, x, now) && membersCompatible(b, y, now)) ||
    (membersCompatible(a, y, now) && membersCompatible(b, x, now))
  );
}

function membersCompatible(
  left: DiscoveryMember,
  right: DiscoveryMember,
  now: Date,
): boolean {
  const leftScene = left.consentedScene;
  const rightScene = right.consentedScene;
  if (!leftScene || !rightScene || leftScene.intent !== rightScene.intent) {
    return false;
  }
  if (leftScene.intent !== "DATING") return true;
  return preferencesAllow(left, right, now) && preferencesAllow(right, left, now);
}

function preferencesAllow(
  actor: DiscoveryMember,
  candidate: DiscoveryMember,
  now: Date,
): boolean {
  const preference = actor.user.discoveryPreference;
  const candidateProfile = candidate.user.profile;
  if (!candidateProfile?.dateOfBirth || !candidateProfile.gender) return false;
  const age = calculateAge(candidateProfile.dateOfBirth, now);
  if (preference?.minAge !== null && preference?.minAge !== undefined && age < preference.minAge) {
    return false;
  }
  if (preference?.maxAge !== null && preference?.maxAge !== undefined && age > preference.maxAge) {
    return false;
  }
  return (
    !preference?.preferredGenders.length ||
    preference.preferredGenders.includes(candidateProfile.gender)
  );
}

export function maxCrossDistanceMeters(
  source: DiscoveryParty,
  target: DiscoveryParty,
): number {
  return Math.max(
    ...source.members.flatMap((left) =>
      target.members.map((right) =>
        haversineMeters(
          Number(left.user.profile!.locationLat),
          Number(left.user.profile!.locationLng),
          Number(right.user.profile!.locationLat),
          Number(right.user.profile!.locationLng),
        ),
      ),
    ),
  );
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateAge(dateOfBirth: Date, now: Date): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const month = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1;
  return age;
}

function distanceSummary(distanceMeters: number): DuoCandidateDto["distance"] {
  return {
    roundedKm: Math.round((distanceMeters / 1000) * 2) / 2,
    band: distanceMeters <= 5_000 ? "LOCAL" : distanceMeters <= 10_000 ? "NEARBY" : "FARTHER",
  };
}

function decodeCursor(value: string | undefined, secret: string, scope: string): DiscoveryCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(openPrivateCursor(value, secret, scope)) as DiscoveryCursor;
    if (
      typeof parsed.distanceMeters !== "number" ||
      !Number.isFinite(parsed.distanceMeters) ||
      Number.isNaN(new Date(parsed.createdAt).getTime()) ||
      typeof parsed.partyId !== "string"
    ) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor; refresh Duo Discover");
  }
}
