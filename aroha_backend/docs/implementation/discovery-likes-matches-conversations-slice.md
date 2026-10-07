FILE: src/common/services/domain-event.publisher.ts
```ts
import { Injectable } from "@nestjs/common";
import { AppLogger } from "../logger/app-logger.service";
import { RedisService } from "../../integrations/redis/redis.service";

export interface DomainEventEnvelope<TPayload = Record<string, unknown>> {
  name: string;
  payload: TPayload;
  occurredAt: string;
}

@Injectable()
export class DomainEventPublisher {
  private static readonly CHANNEL = "domain-events";

  constructor(
    private readonly redis: RedisService,
    private readonly logger: AppLogger,
  ) {}

  async publish<TPayload>(
    name: string,
    payload: TPayload,
  ): Promise<void> {
    const envelope: DomainEventEnvelope<TPayload> = {
      name,
      payload,
      occurredAt: new Date().toISOString(),
    };

    try {
      await this.redis.publish(
        DomainEventPublisher.CHANNEL,
        JSON.stringify(envelope),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to publish domain event ${name}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }

  async publishMany(
    events: Array<{
      name: string;
      payload: Record<string, unknown>;
    }>,
  ): Promise<void> {
    for (const event of events) {
      await this.publish(event.name, event.payload);
    }
  }
}

```

FILE: src/common/utils/distance.util.ts
```ts
export type DistanceBandValue = "LOCAL" | "NEARBY" | "CITY_EDGE" | "REGIONAL";

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = degreesToRadians(lat2 - lat1);
  const dLng = degreesToRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function resolveDistanceBand(distanceKm: number): DistanceBandValue {
  if (distanceKm <= 10) {
    return "LOCAL";
  }
  if (distanceKm <= 25) {
    return "NEARBY";
  }
  if (distanceKm <= 50) {
    return "CITY_EDGE";
  }
  return "REGIONAL";
}

export function resolveDistanceBandScore(
  distanceKm: number,
  maxDistanceKm: number,
): number {
  if (distanceKm <= 10) {
    return 1;
  }
  if (distanceKm <= 25) {
    return 0.8;
  }
  if (distanceKm <= 50) {
    return 0.6;
  }
  if (distanceKm <= maxDistanceKm) {
    return 0.4;
  }
  return 0;
}

export function roundDistanceKm(distanceKm: number): number {
  return Math.round(distanceKm);
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

```

FILE: src/common/utils/pair.util.ts
```ts
export function canonicalUserPair(
  leftUserId: string,
  rightUserId: string,
): {
  userLowId: string;
  userHighId: string;
} {
  return leftUserId < rightUserId
    ? {
        userLowId: leftUserId,
        userHighId: rightUserId,
      }
    : {
        userLowId: rightUserId,
        userHighId: leftUserId,
      };
}

```

FILE: src/app.module.ts
```ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigType } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import appConfig from "./config/app.config";
import authConfig from "./config/auth.config";
import bullmqConfig from "./config/bullmq.config";
import databaseConfig from "./config/database.config";
import objectStorageConfig from "./config/object-storage.config";
import redisConfig from "./config/redis.config";
import { validationSchema } from "./config/validation.schema";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { AppLogger } from "./common/logger/app-logger.service";
import { PrismaModule } from "./database/prisma/prisma.module";
import { BullmqModule } from "./integrations/bullmq/bullmq.module";
import { ObjectStorageModule } from "./integrations/object-storage/object-storage.module";
import { RedisModule } from "./integrations/redis/redis.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { DiscoveryModule } from "./modules/discovery/discovery.module";
import { LikesModule } from "./modules/likes/likes.module";
import { MatchesModule } from "./modules/matches/matches.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { SessionsModule } from "./modules/sessions/sessions.module";
import { InterestsModule } from "./modules/interests/interests.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        redisConfig,
        bullmqConfig,
        objectStorageConfig,
      ],
      validationSchema,
    }),
    ThrottlerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => [
        {
          ttl: config.defaultThrottleTtlMs,
          limit: config.defaultThrottleLimit,
        },
      ],
    }),
    PrismaModule,
    RedisModule,
    BullmqModule,
    ObjectStorageModule,
    UsersModule,
    SessionsModule,
    AuthModule,
    ProfilesModule,
    InterestsModule,
    DiscoveryModule,
    LikesModule,
    MatchesModule,
    ConversationsModule,
  ],
  providers: [
    AppLogger,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}

```

FILE: src/modules/discovery/dto/discovery.dto.ts
```ts
import type { InterestTagDto, LifestyleDto } from "../../profiles/dto/profiles.dto";

export type DistanceBandValue = "LOCAL" | "NEARBY" | "CITY_EDGE" | "REGIONAL" | null;

export interface LocationSummaryDto {
  city: string | null;
  region: string | null;
  countryCode: string | null;
  distanceKmRounded: number;
  distanceBand: DistanceBandValue;
}

export interface PublicPhotoDto {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  isPrimary: boolean;
  position: number;
}

export interface PublicProfileDto {
  userId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  age: number;
  gender:
    | "WOMAN"
    | "MAN"
    | "NON_BINARY"
    | "TRANS_WOMAN"
    | "TRANS_MAN"
    | "AGENDER"
    | "OTHER"
    | "PREFER_NOT_TO_SAY"
    | null;
  pronouns: string | null;
  location: LocationSummaryDto;
  intents: Array<
    "FRIENDSHIP" | "COMPANIONSHIP" | "SHARED_INTERESTS" | "RELATIONSHIP"
  >;
  interests: InterestTagDto[];
  lifestyle: LifestyleDto;
  photos: PublicPhotoDto[];
}

export interface DiscoveryFeedResponseDto {
  items: PublicProfileDto[];
  nextCursor: string | null;
  snapshotExpiresAt: string;
}

```

FILE: src/modules/discovery/domain/discovery.domain.ts
```ts
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import authConfig from "../../../config/auth.config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import {
  haversineDistanceKm,
  resolveDistanceBandScore,
} from "../../../common/utils/distance.util";
import { hashWithPepper } from "../../../common/utils/crypto.util";
import type {
  CandidateDiscoveryRecord,
  ViewerDiscoveryContext,
} from "../infrastructure/discovery.infrastructure";

export interface CandidateEligibilityResult {
  eligible: boolean;
  distanceKm: number;
  primaryIntentBucket: string;
}

export interface ScoredDiscoveryCandidate {
  candidate: CandidateDiscoveryRecord;
  totalScore: number;
  distanceKm: number;
  trustScore: number;
  lastActiveAtMs: number;
  primaryIntentBucket: string;
  cityBucket: string;
  recentlyServed: boolean;
}

@Injectable()
export class DiscoveryAccessPolicy {
  assertViewerCanAccess(viewer: ViewerDiscoveryContext | null): asserts viewer is ViewerDiscoveryContext {
    if (!viewer || viewer.deletedAt) {
      throw new AppException(
        403,
        ERROR_CODES.DISCOVERY_NOT_AVAILABLE,
        "Discovery is not available",
      );
    }

    if (
      viewer.status !== "ACTIVE" ||
      viewer.isShadowBanned ||
      viewer.isDiscoveryFrozen
    ) {
      throw new AppException(
        403,
        ERROR_CODES.DISCOVERY_ACCOUNT_RESTRICTED,
        "Discovery is blocked by account state",
      );
    }

    if (!viewer.profile || !viewer.profile.isComplete || viewer.profile.isHidden) {
      throw new AppException(
        403,
        ERROR_CODES.DISCOVERY_PROFILE_INCOMPLETE,
        "Discovery is blocked until profile is complete",
      );
    }
  }
}

@Injectable()
export class CandidateEligibilityService {
  isEligible(
    viewer: ViewerDiscoveryContext,
    candidate: CandidateDiscoveryRecord,
    input: {
      maxDistanceKm: number;
      selectedIntents: string[];
      preferredGenders: string[];
      excludedUserIds: Set<string>;
    },
  ): CandidateEligibilityResult {
    if (input.excludedUserIds.has(candidate.id)) {
      return { eligible: false, distanceKm: Number.POSITIVE_INFINITY, primaryIntentBucket: "NONE" };
    }

    if (
      !viewer.profile?.dateOfBirth ||
      !viewer.profile.locationLat ||
      !viewer.profile.locationLng ||
      !candidate.profile?.dateOfBirth ||
      candidate.profile.locationLat === null ||
      candidate.profile.locationLng === null
    ) {
      return { eligible: false, distanceKm: Number.POSITIVE_INFINITY, primaryIntentBucket: "NONE" };
    }

    const candidateAge = calculateAge(candidate.profile.dateOfBirth);
    const distanceKm = haversineDistanceKm(
      Number(viewer.profile.locationLat.toString()),
      Number(viewer.profile.locationLng.toString()),
      Number(candidate.profile.locationLat.toString()),
      Number(candidate.profile.locationLng.toString()),
    );

    if (
      viewer.discoveryPreference?.minAge !== null &&
      viewer.discoveryPreference?.minAge !== undefined &&
      candidateAge < viewer.discoveryPreference.minAge
    ) {
      return { eligible: false, distanceKm, primaryIntentBucket: "NONE" };
    }

    if (
      viewer.discoveryPreference?.maxAge !== null &&
      viewer.discoveryPreference?.maxAge !== undefined &&
      candidateAge > viewer.discoveryPreference.maxAge
    ) {
      return { eligible: false, distanceKm, primaryIntentBucket: "NONE" };
    }

    if (distanceKm > input.maxDistanceKm) {
      return { eligible: false, distanceKm, primaryIntentBucket: "NONE" };
    }

    if (
      input.preferredGenders.length > 0 &&
      (!candidate.profile.gender ||
        !input.preferredGenders.includes(candidate.profile.gender))
    ) {
      return { eligible: false, distanceKm, primaryIntentBucket: "NONE" };
    }

    const candidateIntentSet = new Set(candidate.intents.map((intent) => intent.intent));
    const overlappingIntents = input.selectedIntents.filter((intent) =>
      candidateIntentSet.has(intent as any),
    );

    if (overlappingIntents.length === 0) {
      return { eligible: false, distanceKm, primaryIntentBucket: "NONE" };
    }

    return {
      eligible: true,
      distanceKm,
      primaryIntentBucket: overlappingIntents.sort()[0] ?? "NONE",
    };
  }
}

@Injectable()
export class DiscoveryRankingService {
  scoreCandidate(
    viewer: ViewerDiscoveryContext,
    candidate: CandidateDiscoveryRecord,
    input: {
      distanceKm: number;
      primaryIntentBucket: string;
      recentlyServed: boolean;
    },
  ): ScoredDiscoveryCandidate {
    const selectedIntents = resolveSelectedIntents(viewer);
    const candidateIntents = candidate.intents.map((intent) => intent.intent);
    const intentScore =
      30 *
      overlapRatio(
        selectedIntents,
        candidateIntents,
      );
    const interestScore =
      20 *
      jaccardIndex(
        viewer.interests.map((interest) => interest.interestTagId),
        candidate.interests.map((interest) => interest.interestTagId),
      );
    const lifestyleScore =
      15 *
      normalizedLifestyleCompatibility(
        viewer.lifestyle,
        candidate.lifestyle,
      );
    const scheduleScore =
      10 *
      normalizedScheduleOverlap(
        viewer.schedulePreference,
        candidate.schedulePreference,
      );
    const maxDistanceKm =
      viewer.discoveryPreference?.maxDistanceKm ?? input.distanceKm;
    const distanceScore =
      10 * resolveDistanceBandScore(input.distanceKm, maxDistanceKm);
    const freshnessScore =
      10 * recentActivityScore(candidate.lastActiveAt);
    const trustRaw = candidate.trustScore?.score ?? 70;
    const trustScore = 5 * normalizedTrustScore(trustRaw);
    const trustPenalty = resolveTrustPenalty(trustRaw);

    const totalScore =
      intentScore +
      interestScore +
      lifestyleScore +
      scheduleScore +
      distanceScore +
      freshnessScore +
      trustScore -
      trustPenalty;

    return {
      candidate,
      totalScore,
      distanceKm: input.distanceKm,
      trustScore: trustRaw,
      lastActiveAtMs: candidate.lastActiveAt?.getTime() ?? 0,
      primaryIntentBucket: input.primaryIntentBucket,
      cityBucket:
        [candidate.profile?.city, candidate.profile?.region, candidate.profile?.countryCode]
          .filter(Boolean)
          .join("|") || "UNKNOWN",
      recentlyServed: input.recentlyServed,
    };
  }
}

@Injectable()
export class DiscoveryDiversityService {
  orderCandidates(input: ScoredDiscoveryCandidate[]): ScoredDiscoveryCandidate[] {
    const remaining = [...input];
    const ordered: ScoredDiscoveryCandidate[] = [];

    while (remaining.length > 0) {
      const index = remaining.findIndex((candidate) =>
        !violatesIntentStreak(ordered, candidate) &&
        !violatesCityStreak(ordered, candidate),
      );
      const chosenIndex = index >= 0 ? index : 0;
      const chosen = remaining[chosenIndex];
      if (!chosen) {
        break;
      }
      ordered.push(chosen);
      remaining.splice(chosenIndex, 1);
    }

    return ordered;
  }
}

@Injectable()
export class DiscoveryPayloadMapperService {
  mapPreferenceHash(viewer: ViewerDiscoveryContext): string {
    return stablePreferenceHash({
      discoveryPreference: viewer.discoveryPreference,
      intents: viewer.intents.map((intent) => intent.intent).sort(),
      userId: viewer.id,
    });
  }
}

function stablePreferenceHash(value: Record<string, unknown>): string {
  return hashWithPepper(JSON.stringify(value), "discovery-preference-hash").slice(
    0,
    32,
  );
}

function resolveSelectedIntents(viewer: ViewerDiscoveryContext): string[] {
  const filtered = viewer.discoveryPreference?.intentFilter ?? [];
  if (filtered.length > 0) {
    return [...filtered].sort();
  }

  return viewer.intents.map((intent) => intent.intent).sort();
}

function overlapRatio(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightSet = new Set(right);
  const overlap = left.filter((value) => rightSet.has(value)).length;
  return overlap / Math.max(left.length, right.length);
}

function jaccardIndex(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);

  if (union.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) {
      overlap += 1;
    }
  }

  return overlap / union.size;
}

function normalizedLifestyleCompatibility(
  left: ViewerDiscoveryContext["lifestyle"],
  right: CandidateDiscoveryRecord["lifestyle"],
): number {
  const pairs = [
    [left?.smoking ?? null, right?.smoking ?? null],
    [left?.drinking ?? null, right?.drinking ?? null],
    [left?.exercise ?? null, right?.exercise ?? null],
    [left?.diet ?? null, right?.diet ?? null],
    [left?.petPreference ?? null, right?.petPreference ?? null],
    [left?.sleepPattern ?? null, right?.sleepPattern ?? null],
    [left?.socialEnergy ?? null, right?.socialEnergy ?? null],
  ];

  const comparable = pairs.filter(([leftValue, rightValue]) => leftValue && rightValue);
  if (comparable.length === 0) {
    return 0;
  }

  const matches = comparable.filter(
    ([leftValue, rightValue]) => leftValue === rightValue,
  ).length;

  return matches / comparable.length;
}

function normalizedScheduleOverlap(
  left: ViewerDiscoveryContext["schedulePreference"],
  right: CandidateDiscoveryRecord["schedulePreference"],
): number {
  if (!left || !right) {
    return 0;
  }

  const weekdayOverlap = overlapBits(left.weekdayMask, right.weekdayMask);
  const timeBlockOverlap = overlapBits(left.timeBlockMask, right.timeBlockMask);
  const preferenceMatches = [
    left.prefersWeekends === right.prefersWeekends ? 1 : 0,
    left.remoteFriendly === right.remoteFriendly ? 1 : 0,
  ];

  return (
    weekdayOverlap * 0.4 +
    timeBlockOverlap * 0.4 +
    ((preferenceMatches[0] ?? 0) + (preferenceMatches[1] ?? 0)) / 2 * 0.2
  );
}

function overlapBits(left: number, right: number): number {
  const union = left | right;
  if (union === 0) {
    return 0;
  }

  const overlap = left & right;
  return popCount(overlap) / popCount(union);
}

function popCount(value: number): number {
  let count = 0;
  let current = value >>> 0;
  while (current > 0) {
    current &= current - 1;
    count += 1;
  }
  return count;
}

function recentActivityScore(lastActiveAt: Date | null): number {
  if (!lastActiveAt) {
    return 0.1;
  }

  const hoursSinceActive =
    (Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60);

  if (hoursSinceActive <= 24) {
    return 1;
  }
  if (hoursSinceActive <= 72) {
    return 0.7;
  }
  if (hoursSinceActive <= 24 * 7) {
    return 0.4;
  }
  return 0.1;
}

function normalizedTrustScore(score: number): number {
  return Math.max(0, Math.min(score, 100)) / 100;
}

function resolveTrustPenalty(score: number): number {
  if (score >= 70) {
    return 0;
  }
  if (score >= 50) {
    return 2;
  }
  if (score >= 30) {
    return 5;
  }
  return 10;
}

function violatesIntentStreak(
  ordered: ScoredDiscoveryCandidate[],
  candidate: ScoredDiscoveryCandidate,
): boolean {
  if (ordered.length < 2) {
    return false;
  }

  const last = ordered[ordered.length - 1];
  const previous = ordered[ordered.length - 2];
  if (!last || !previous) {
    return false;
  }

  return (
    last.primaryIntentBucket === candidate.primaryIntentBucket &&
    previous.primaryIntentBucket === candidate.primaryIntentBucket
  );
}

function violatesCityStreak(
  ordered: ScoredDiscoveryCandidate[],
  candidate: ScoredDiscoveryCandidate,
): boolean {
  if (ordered.length < 3) {
    return false;
  }

  const tail = ordered.slice(-3);
  return tail.every((entry) => entry.cityBucket === candidate.cityBucket);
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDifference = today.getUTCMonth() - dateOfBirth.getUTCMonth();
  const dayDifference = today.getUTCDate() - dateOfBirth.getUTCDate();

  if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
    age -= 1;
  }

  return age;
}

```

FILE: src/modules/discovery/policies/discovery.policies.ts
```ts
export { DiscoveryAccessPolicy } from "../domain/discovery.domain";

```

FILE: src/modules/discovery/events/discovery.events.ts
```ts
export const DISCOVERY_EVENTS = {
  SNAPSHOT_INVALIDATED: "discovery.snapshot-invalidated",
} as const;

```

FILE: src/modules/discovery/infrastructure/discovery.infrastructure.ts
```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { RedisService } from "../../../integrations/redis/redis.service";
import type {
  InterestTag,
  Match,
  ProfilePhoto,
  TrustScore,
  User,
  UserDiscoveryPreference,
  UserIntent,
  UserInterest,
  UserLifestyle,
  UserProfile,
  UserSchedulePreference,
} from "../../../generated/prisma/client";

export interface ViewerDiscoveryContext extends User {
  profile: UserProfile | null;
  discoveryPreference: UserDiscoveryPreference | null;
  intents: Pick<UserIntent, "intent">[];
  interests: Pick<UserInterest, "interestTagId">[];
  lifestyle: UserLifestyle | null;
  schedulePreference: UserSchedulePreference | null;
  trustScore: TrustScore | null;
}

export interface CandidateDiscoveryRecord extends User {
  profile: UserProfile;
  photos: Pick<
    ProfilePhoto,
    "id" | "objectKey" | "bucket" | "width" | "height" | "isPrimary" | "position"
  >[];
  intents: Pick<UserIntent, "intent">[];
  interests: (Pick<UserInterest, "interestTagId"> & {
    interestTag: Pick<InterestTag, "id" | "slug" | "displayName" | "category">;
  })[];
  lifestyle: UserLifestyle | null;
  schedulePreference: UserSchedulePreference | null;
  trustScore: TrustScore | null;
}

export interface DiscoveryExclusionState {
  blockedUserIds: Set<string>;
  matchedUserIds: Set<string>;
  activePassUserIds: Set<string>;
  activeLikeUserIds: Set<string>;
}

export interface DiscoverySnapshot {
  snapshotId: string;
  viewerId: string;
  preferenceHash: string;
  candidateIds: string[];
  createdAt: string;
  expiresAt: string;
}

@Injectable()
export class DiscoveryQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findViewerContext(userId: string): Promise<ViewerDiscoveryContext | null> {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        profile: true,
        discoveryPreference: true,
        intents: {
          where: {
            deletedAt: null,
          },
          select: {
            intent: true,
          },
        },
        interests: {
          where: {
            deletedAt: null,
          },
          select: {
            interestTagId: true,
          },
        },
        lifestyle: true,
        schedulePreference: true,
        trustScore: true,
      },
    });
  }

  async loadExclusionState(
    viewerId: string,
    now: Date,
  ): Promise<DiscoveryExclusionState> {
    const [blocks, matches, passes, likes] = await Promise.all([
      this.prisma.block.findMany({
        where: {
          deletedAt: null,
          OR: [{ blockerId: viewerId }, { blockedId: viewerId }],
        },
        select: {
          blockerId: true,
          blockedId: true,
        },
      }),
      this.prisma.match.findMany({
        where: {
          OR: [{ userLowId: viewerId }, { userHighId: viewerId }],
        },
        select: {
          userLowId: true,
          userHighId: true,
        },
      }),
      this.prisma.pass.findMany({
        where: {
          actorId: viewerId,
          deletedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        select: {
          targetId: true,
        },
      }),
      this.prisma.like.findMany({
        where: {
          actorId: viewerId,
          status: "ACTIVE",
        },
        select: {
          targetId: true,
        },
      }),
    ]);

    const blockedUserIds = new Set<string>();
    for (const block of blocks) {
      blockedUserIds.add(block.blockerId === viewerId ? block.blockedId : block.blockerId);
    }

    const matchedUserIds = new Set<string>();
    for (const match of matches) {
      matchedUserIds.add(match.userLowId === viewerId ? match.userHighId : match.userLowId);
    }

    return {
      blockedUserIds,
      matchedUserIds,
      activePassUserIds: new Set(passes.map((pass) => pass.targetId)),
      activeLikeUserIds: new Set(likes.map((like) => like.targetId)),
    };
  }

  async listCandidatePool(input: {
    viewerId: string;
    activeSince: Date | null;
  }): Promise<CandidateDiscoveryRecord[]> {
    return this.prisma.user.findMany({
      where: {
        id: {
          not: input.viewerId,
        },
        status: "ACTIVE",
        deletedAt: null,
        isShadowBanned: false,
        isDiscoveryFrozen: false,
        ...(input.activeSince
          ? {
              lastActiveAt: {
                gte: input.activeSince,
              },
            }
          : {}),
        profile: {
          is: {
            deletedAt: null,
            isHidden: false,
            isComplete: true,
          },
        },
        photos: {
          some: {
            moderationStatus: "APPROVED",
            deletedAt: null,
          },
        },
      },
      include: {
        profile: true,
        photos: {
          where: {
            moderationStatus: "APPROVED",
            deletedAt: null,
          },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            objectKey: true,
            bucket: true,
            width: true,
            height: true,
            isPrimary: true,
            position: true,
          },
        },
        intents: {
          where: {
            deletedAt: null,
          },
          select: {
            intent: true,
          },
        },
        interests: {
          where: {
            deletedAt: null,
          },
          select: {
            interestTagId: true,
            interestTag: {
              select: {
                id: true,
                slug: true,
                displayName: true,
                category: true,
              },
            },
          },
        },
        lifestyle: true,
        schedulePreference: true,
        trustScore: true,
      },
    }) as Promise<CandidateDiscoveryRecord[]>;
  }

  async findCandidatesByIds(candidateIds: string[]): Promise<CandidateDiscoveryRecord[]> {
    if (candidateIds.length === 0) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        id: {
          in: candidateIds,
        },
        status: "ACTIVE",
        deletedAt: null,
        isShadowBanned: false,
        isDiscoveryFrozen: false,
        profile: {
          is: {
            deletedAt: null,
            isHidden: false,
            isComplete: true,
          },
        },
        photos: {
          some: {
            moderationStatus: "APPROVED",
            deletedAt: null,
          },
        },
      },
      include: {
        profile: true,
        photos: {
          where: {
            moderationStatus: "APPROVED",
            deletedAt: null,
          },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            objectKey: true,
            bucket: true,
            width: true,
            height: true,
            isPrimary: true,
            position: true,
          },
        },
        intents: {
          where: {
            deletedAt: null,
          },
          select: {
            intent: true,
          },
        },
        interests: {
          where: {
            deletedAt: null,
          },
          select: {
            interestTagId: true,
            interestTag: {
              select: {
                id: true,
                slug: true,
                displayName: true,
                category: true,
              },
            },
          },
        },
        lifestyle: true,
        schedulePreference: true,
        trustScore: true,
      },
    }) as Promise<CandidateDiscoveryRecord[]>;
  }
}

@Injectable()
export class DiscoverySnapshotRepository {
  private static readonly SNAPSHOT_KEY_PREFIX = "discovery:snapshot:";
  private static readonly SERVED_KEY_PREFIX = "discovery:served:";

  constructor(private readonly redis: RedisService) {}

  async get(
    viewerId: string,
    preferenceHash: string,
  ): Promise<DiscoverySnapshot | null> {
    const raw = await this.redis.get(this.snapshotKey(viewerId, preferenceHash));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as DiscoverySnapshot;
  }

  async set(
    snapshot: DiscoverySnapshot,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(
      this.snapshotKey(snapshot.viewerId, snapshot.preferenceHash),
      JSON.stringify(snapshot),
      "EX",
      ttlSeconds,
    );
  }

  async invalidateViewer(viewerId: string): Promise<void> {
    const pattern = `${DiscoverySnapshotRepository.SNAPSHOT_KEY_PREFIX}${viewerId}:*`;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== "0");
  }

  async readRecentlyServedFlags(
    viewerId: string,
    candidateIds: string[],
  ): Promise<Set<string>> {
    if (candidateIds.length === 0) {
      return new Set();
    }

    const pipeline = this.redis.pipeline();
    const keys = candidateIds.map((candidateId) =>
      this.servedKey(viewerId, candidateId),
    );
    for (const key of keys) {
      pipeline.get(key);
    }
    const values = await pipeline.exec();
    const result = new Set<string>();

    values?.forEach((entry, index) => {
      const value = entry?.[1];
      const candidateId = candidateIds[index];
      if (value && candidateId) {
        result.add(candidateId);
      }
    });

    return result;
  }

  async markRecentlyServed(
    viewerId: string,
    candidateIds: string[],
  ): Promise<void> {
    if (candidateIds.length === 0) {
      return;
    }

    const pipeline = this.redis.pipeline();
    for (const candidateId of candidateIds) {
      pipeline.set(
        this.servedKey(viewerId, candidateId),
        "1",
        "EX",
        24 * 60 * 60,
      );
    }
    await pipeline.exec();
  }

  private snapshotKey(viewerId: string, preferenceHash: string): string {
    return `${DiscoverySnapshotRepository.SNAPSHOT_KEY_PREFIX}${viewerId}:${preferenceHash}`;
  }

  private servedKey(viewerId: string, candidateId: string): string {
    return `${DiscoverySnapshotRepository.SERVED_KEY_PREFIX}${viewerId}:${candidateId}`;
  }
}

```

FILE: src/modules/discovery/application/discovery.services.ts
```ts
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import authConfig from "../../../config/auth.config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { hashWithPepper, safeEqualHex } from "../../../common/utils/crypto.util";
import {
  haversineDistanceKm,
  roundDistanceKm,
  type DistanceBandValue,
  resolveDistanceBand,
} from "../../../common/utils/distance.util";
import type { InterestTagDto, LifestyleDto } from "../../profiles/dto/profiles.dto";
import type {
  DiscoveryFeedResponseDto,
  LocationSummaryDto,
  PublicPhotoDto,
  PublicProfileDto,
} from "../dto/discovery.dto";
import {
  CandidateEligibilityService,
  DiscoveryAccessPolicy,
  DiscoveryDiversityService,
  DiscoveryPayloadMapperService,
  DiscoveryRankingService,
  type ScoredDiscoveryCandidate,
} from "../domain/discovery.domain";
import {
  DiscoveryQueryRepository,
  DiscoverySnapshotRepository,
  type CandidateDiscoveryRecord,
  type DiscoverySnapshot,
  type ViewerDiscoveryContext,
} from "../infrastructure/discovery.infrastructure";

const SNAPSHOT_TTL_SECONDS = 120;

@Injectable()
export class InvalidateDiscoverySnapshotService {
  constructor(
    private readonly discoverySnapshotRepository: DiscoverySnapshotRepository,
  ) {}

  async execute(viewerId: string): Promise<void> {
    await this.discoverySnapshotRepository.invalidateViewer(viewerId);
  }
}

@Injectable()
export class GetDiscoveryFeedService {
  constructor(
    private readonly discoveryQueryRepository: DiscoveryQueryRepository,
    private readonly discoverySnapshotRepository: DiscoverySnapshotRepository,
    private readonly discoveryAccessPolicy: DiscoveryAccessPolicy,
    private readonly candidateEligibilityService: CandidateEligibilityService,
    private readonly discoveryRankingService: DiscoveryRankingService,
    private readonly discoveryDiversityService: DiscoveryDiversityService,
    private readonly discoveryPayloadMapperService: DiscoveryPayloadMapperService,
    @Inject(authConfig.KEY)
    private readonly authConfiguration: ConfigType<typeof authConfig>,
  ) {}

  async execute(input: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<DiscoveryFeedResponseDto> {
    const limit = Math.min(input.limit ?? 20, 50);
    const viewer = await this.discoveryQueryRepository.findViewerContext(input.userId);
    this.discoveryAccessPolicy.assertViewerCanAccess(viewer);

    const preferenceHash = this.discoveryPayloadMapperService.mapPreferenceHash(viewer);
    const cachedSnapshot = await this.discoverySnapshotRepository.get(
      viewer.id,
      preferenceHash,
    );
    const now = new Date();

    let snapshot = cachedSnapshot;
    let nextIndex = 0;

    if (input.cursor) {
      const parsedCursor = parseCursorOrThrow(
        input.cursor,
        viewer.id,
        this.authConfiguration.passwordPepper,
      );

      if (
        !snapshot ||
        snapshot.snapshotId !== parsedCursor.snapshotId ||
        new Date(snapshot.expiresAt).getTime() < Date.now()
      ) {
        throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
      }

      nextIndex = parsedCursor.nextIndex;
    }

    if (!snapshot) {
      snapshot = await this.buildSnapshot(viewer, preferenceHash, now);
    }

    const pageIds = snapshot.candidateIds.slice(nextIndex, nextIndex + limit);
    const pageRecords = await this.discoveryQueryRepository.findCandidatesByIds(pageIds);
    const recordsById = new Map(pageRecords.map((record) => [record.id, record]));
    const items = pageIds
      .map((candidateId) => recordsById.get(candidateId))
      .filter((candidate): candidate is CandidateDiscoveryRecord => !!candidate)
      .map((candidate) => mapPublicProfile(viewer, candidate));

    await this.discoverySnapshotRepository.markRecentlyServed(
      viewer.id,
      items.map((item) => item.userId),
    );

    const newIndex = nextIndex + pageIds.length;
    const nextCursor =
      newIndex < snapshot.candidateIds.length
        ? signCursor(
            {
              snapshotId: snapshot.snapshotId,
              nextIndex: newIndex,
              expiresAt: snapshot.expiresAt,
            },
            viewer.id,
            this.authConfiguration.passwordPepper,
          )
        : null;

    return {
      items,
      nextCursor,
      snapshotExpiresAt: snapshot.expiresAt,
    };
  }

  private async buildSnapshot(
    viewer: ViewerDiscoveryContext,
    preferenceHash: string,
    now: Date,
  ): Promise<DiscoverySnapshot> {
    const exclusionState = await this.discoveryQueryRepository.loadExclusionState(
      viewer.id,
      now,
    );

    const attempts = [
      {
        maxDistanceKm: viewer.discoveryPreference?.maxDistanceKm ?? 50,
        activeSince: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        maxDistanceKm: Math.min(
          250,
          2 * (viewer.discoveryPreference?.maxDistanceKm ?? 50),
        ),
        activeSince: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        maxDistanceKm: Math.min(
          250,
          2 * (viewer.discoveryPreference?.maxDistanceKm ?? 50),
        ),
        activeSince: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    ];

    let candidateIds: string[] = [];
    for (const attempt of attempts) {
      const candidates = await this.discoveryQueryRepository.listCandidatePool({
        viewerId: viewer.id,
        activeSince: attempt.activeSince,
      });
      const recentlyServed = await this.discoverySnapshotRepository.readRecentlyServedFlags(
        viewer.id,
        candidates.map((candidate) => candidate.id),
      );

      const selectedIntents =
        viewer.discoveryPreference?.intentFilter &&
        viewer.discoveryPreference.intentFilter.length > 0
          ? viewer.discoveryPreference.intentFilter
          : viewer.intents.map((intent) => intent.intent);
      const preferredGenders = viewer.discoveryPreference?.preferredGenders ?? [];
      const excludedUserIds = new Set<string>([
        viewer.id,
        ...exclusionState.blockedUserIds,
        ...exclusionState.matchedUserIds,
        ...exclusionState.activePassUserIds,
        ...exclusionState.activeLikeUserIds,
      ]);

      const scored = candidates
        .map((candidate) => {
          const eligibility = this.candidateEligibilityService.isEligible(
            viewer,
            candidate,
            {
              maxDistanceKm: attempt.maxDistanceKm,
              selectedIntents,
              preferredGenders,
              excludedUserIds,
            },
          );

          if (!eligibility.eligible) {
            return null;
          }

          return this.discoveryRankingService.scoreCandidate(viewer, candidate, {
            distanceKm: eligibility.distanceKm,
            primaryIntentBucket: eligibility.primaryIntentBucket,
            recentlyServed: recentlyServed.has(candidate.id),
          });
        })
        .filter((candidate): candidate is ScoredDiscoveryCandidate => !!candidate)
        .sort((left, right) => compareScoredCandidates(left, right, viewer));

      if (scored.length > 0) {
        candidateIds = this.discoveryDiversityService
          .orderCandidates(scored)
          .map((candidate) => candidate.candidate.id);
        break;
      }
    }

    const snapshot: DiscoverySnapshot = {
      snapshotId: randomUUID(),
      viewerId: viewer.id,
      preferenceHash,
      candidateIds,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SNAPSHOT_TTL_SECONDS * 1000).toISOString(),
    };

    await this.discoverySnapshotRepository.set(snapshot, SNAPSHOT_TTL_SECONDS);
    return snapshot;
  }
}

@Injectable()
export class DiscoveryQueryService {
  constructor(private readonly getDiscoveryFeedService: GetDiscoveryFeedService) {}

  async getFeed(input: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<DiscoveryFeedResponseDto> {
    return this.getDiscoveryFeedService.execute(input);
  }
}

function compareScoredCandidates(
  left: ScoredDiscoveryCandidate,
  right: ScoredDiscoveryCandidate,
  viewer: ViewerDiscoveryContext,
): number {
  if (left.recentlyServed !== right.recentlyServed) {
    return left.recentlyServed ? 1 : -1;
  }
  if (right.totalScore !== left.totalScore) {
    return right.totalScore - left.totalScore;
  }
  if (viewer.discoveryPreference?.preferSameCity) {
    const leftSameCity = isSameCity(viewer, left.candidate) ? 1 : 0;
    const rightSameCity = isSameCity(viewer, right.candidate) ? 1 : 0;
    if (rightSameCity !== leftSameCity) {
      return rightSameCity - leftSameCity;
    }
  }
  if (right.trustScore !== left.trustScore) {
    return right.trustScore - left.trustScore;
  }
  if (right.lastActiveAtMs !== left.lastActiveAtMs) {
    return right.lastActiveAtMs - left.lastActiveAtMs;
  }
  return left.candidate.id.localeCompare(right.candidate.id);
}

function isSameCity(
  viewer: ViewerDiscoveryContext,
  candidate: CandidateDiscoveryRecord,
): boolean {
  return (
    normalize(viewer.profile?.city) === normalize(candidate.profile.city) &&
    normalize(viewer.profile?.region) === normalize(candidate.profile.region)
  );
}

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function mapPublicProfile(
  viewer: ViewerDiscoveryContext,
  candidate: CandidateDiscoveryRecord,
): PublicProfileDto {
  const distance = resolveDistance(viewer, candidate);

  return {
    userId: candidate.id,
    displayName: candidate.profile.displayName ?? "Unknown",
    headline: candidate.profile.headline ?? null,
    bio: candidate.profile.bio ?? null,
    age: candidate.profile.dateOfBirth
      ? calculateAge(candidate.profile.dateOfBirth)
      : 0,
    gender: candidate.profile.gender ?? null,
    pronouns: candidate.profile.pronouns ?? null,
    location: distance,
    intents: candidate.intents.map((intent) => intent.intent as PublicProfileDto["intents"][number]),
    interests: candidate.interests.map(
      (interest): InterestTagDto => ({
        id: interest.interestTag.id,
        slug: interest.interestTag.slug,
        displayName: interest.interestTag.displayName,
        category: interest.interestTag.category,
      }),
    ),
    lifestyle: {
      smoking: candidate.lifestyle?.smoking ?? null,
      drinking: candidate.lifestyle?.drinking ?? null,
      exercise: candidate.lifestyle?.exercise ?? null,
      diet: candidate.lifestyle?.diet ?? null,
      petPreference: candidate.lifestyle?.petPreference ?? null,
      sleepPattern: candidate.lifestyle?.sleepPattern ?? null,
      socialEnergy: candidate.lifestyle?.socialEnergy ?? null,
    } satisfies LifestyleDto,
    photos: candidate.photos.map(
      (photo): PublicPhotoDto => ({
        id: photo.id,
        url: buildPhotoUrl(photo.bucket, photo.objectKey),
        width: photo.width ?? null,
        height: photo.height ?? null,
        isPrimary: photo.isPrimary,
        position: photo.position,
      }),
    ),
  };
}

function resolveDistance(
  viewer: ViewerDiscoveryContext,
  candidate: CandidateDiscoveryRecord,
): LocationSummaryDto {
  if (
    candidate.profile.hideDistance ||
    !viewer.profile?.locationLat ||
    !viewer.profile?.locationLng ||
    candidate.profile.locationLat === null ||
    candidate.profile.locationLng === null
  ) {
    return {
      city: candidate.profile.city ?? null,
      region: candidate.profile.region ?? null,
      countryCode: candidate.profile.countryCode ?? null,
      distanceKmRounded: 0,
      distanceBand: null,
    };
  }

  const distanceKm = roundDistanceKm(
    Math.max(
      0,
      haversineDistanceKm(
        Number(viewer.profile.locationLat.toString()),
        Number(viewer.profile.locationLng.toString()),
        Number(candidate.profile.locationLat.toString()),
        Number(candidate.profile.locationLng.toString()),
      ),
    ),
  );

  return {
    city: candidate.profile.city ?? null,
    region: candidate.profile.region ?? null,
    countryCode: candidate.profile.countryCode ?? null,
    distanceKmRounded: distanceKm,
    distanceBand: resolveDistanceBand(distanceKm) as DistanceBandValue,
  };
}

function buildPhotoUrl(bucket: string, objectKey: string): string {
  return `s3://${bucket}/${objectKey}`;
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDifference = today.getUTCMonth() - dateOfBirth.getUTCMonth();
  const dayDifference = today.getUTCDate() - dateOfBirth.getUTCDate();

  if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
    age -= 1;
  }

  return age;
}

function signCursor(
  payload: {
    snapshotId: string;
    nextIndex: number;
    expiresAt: string;
  },
  viewerId: string,
  secret: string,
): string {
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      viewerId,
    }),
    "utf8",
  ).toString("base64url");
  const signature = hashWithPepper(body, secret);
  return `${body}.${signature}`;
}

function parseCursorOrThrow(
  cursor: string,
  viewerId: string,
  secret: string,
): {
  snapshotId: string;
  nextIndex: number;
  expiresAt: string;
} {
  const [body, signature] = cursor.split(".");

  if (!body || !signature) {
    throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
  }

  const expectedSignature = hashWithPepper(body, secret);
  if (!safeEqualHex(signature, expectedSignature)) {
    throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
  }

  const decoded = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8"),
  ) as {
    snapshotId?: string;
    nextIndex?: number;
    expiresAt?: string;
    viewerId?: string;
  };

  if (
    typeof decoded.snapshotId !== "string" ||
    typeof decoded.nextIndex !== "number" ||
    typeof decoded.expiresAt !== "string" ||
    decoded.viewerId !== viewerId ||
    new Date(decoded.expiresAt).getTime() < Date.now()
  ) {
    throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
  }

  return {
    snapshotId: decoded.snapshotId,
    nextIndex: decoded.nextIndex,
    expiresAt: decoded.expiresAt,
  };
}

```

FILE: src/modules/discovery/controllers/discovery.controller.ts
```ts
import { Controller, Get, Query } from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CursorPageQueryDto } from "../../../common/dto/cursor-page-query.dto";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { GetDiscoveryFeedService } from "../application/discovery.services";
import type { DiscoveryFeedResponseDto } from "../dto/discovery.dto";

@Controller("discovery")
export class DiscoveryController {
  constructor(
    private readonly getDiscoveryFeedService: GetDiscoveryFeedService,
  ) {}

  @Get("feed")
  async getFeed(
    @CurrentUser() user: AuthContext["user"],
    @Query() query: CursorPageQueryDto,
  ): Promise<DiscoveryFeedResponseDto> {
    return this.getDiscoveryFeedService.execute({
      userId: user.id,
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 50) : 20,
    });
  }
}

```

FILE: src/modules/discovery/discovery.module.ts
```ts
import { Module } from "@nestjs/common";
import { DiscoveryController } from "./controllers/discovery.controller";
import {
  DiscoveryQueryService,
  GetDiscoveryFeedService,
  InvalidateDiscoverySnapshotService,
} from "./application/discovery.services";
import {
  CandidateEligibilityService,
  DiscoveryAccessPolicy,
  DiscoveryDiversityService,
  DiscoveryPayloadMapperService,
  DiscoveryRankingService,
} from "./domain/discovery.domain";
import {
  DiscoveryQueryRepository,
  DiscoverySnapshotRepository,
} from "./infrastructure/discovery.infrastructure";

@Module({
  controllers: [DiscoveryController],
  providers: [
    GetDiscoveryFeedService,
    InvalidateDiscoverySnapshotService,
    DiscoveryQueryService,
    DiscoveryAccessPolicy,
    CandidateEligibilityService,
    DiscoveryRankingService,
    DiscoveryDiversityService,
    DiscoveryPayloadMapperService,
    DiscoveryQueryRepository,
    DiscoverySnapshotRepository,
  ],
  exports: [InvalidateDiscoverySnapshotService, DiscoveryQueryService],
})
export class DiscoveryModule {}

```

FILE: src/modules/conversations/dto/conversations.dto.ts
```ts
import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { PublicProfileDto } from "../../discovery/dto/discovery.dto";

export interface ConversationSummaryDto {
  id: string;
  matchId: string;
  status: "ACTIVE" | "BLOCKED" | "CLOSED_UNMATCHED" | "CLOSED_MODERATION";
  otherUser: PublicProfileDto;
  lastMessageSequence: number;
  lastMessagePreview: string | null;
  lastMessageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SYSTEM" | null;
  lastMessageSentAt: string | null;
  lastSenderId: string | null;
  lastReadSequence: number;
  unreadCount: number;
  closedAt: string | null;
  closedReason: "BLOCKED" | "UNMATCHED" | "MODERATION" | "ACCOUNT_DELETED" | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationPageDto {
  items: ConversationSummaryDto[];
  nextCursor: string | null;
}

export interface ConversationDetailResponseDto {
  conversation: ConversationSummaryDto;
}

export interface MessageAttachmentDto {
  objectKey: string | null;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  sequence: number;
  clientMessageId: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SYSTEM";
  textBody: string | null;
  attachment: MessageAttachmentDto;
  status:
    | "ACTIVE"
    | "PENDING_MODERATION"
    | "REMOVED_BY_MODERATION"
    | "DELETED_BY_SENDER";
  replyToMessageId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessagePageDto {
  items: MessageDto[];
  nextCursor: string | null;
}

export class ConversationReadRequestDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  readonly lastReadSequence!: number;
}

export interface ConversationReadDto {
  conversationId: string;
  userId: string;
  lastReadMessageId: string | null;
  lastReadSequence: number;
  lastReadAt: string;
}

export interface ConversationReadResponseDto {
  readState: ConversationReadDto;
}

export class ConversationMessagePageQueryDto {
  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number;
}

```

FILE: src/modules/conversations/domain/conversations.domain.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { Conversation, Match } from "../../../generated/prisma/client";

@Injectable()
export class ConversationAccessPolicyService {
  assertParticipant(
    userId: string,
    match: Pick<Match, "userLowId" | "userHighId"> | null,
  ): asserts match is Pick<Match, "userLowId" | "userHighId"> {
    if (!match || (match.userLowId !== userId && match.userHighId !== userId)) {
      throw new AppException(
        403,
        ERROR_CODES.CONVERSATION_NOT_ACCESSIBLE,
        "Conversation is not accessible",
      );
    }
  }

  assertReadable<TConversation extends Conversation>(
    conversation: TConversation | null,
  ): asserts conversation is TConversation {
    if (!conversation) {
      throw new AppException(
        404,
        ERROR_CODES.CONVERSATION_NOT_FOUND,
        "Conversation not found",
      );
    }
  }

  assertCanUpdateReadState(
    conversation: Pick<Conversation, "status" | "lastMessageSequence">,
    match: Pick<Match, "status">,
    input: {
      currentLastReadSequence: number;
      requestedLastReadSequence: number;
    },
  ): void {
    if (conversation.status !== "ACTIVE" || match.status !== "ACTIVE") {
      throw new AppException(
        409,
        ERROR_CODES.CONVERSATION_CLOSED,
        "Conversation no longer accepts activity",
      );
    }

    if (input.requestedLastReadSequence < input.currentLastReadSequence) {
      throw new AppException(
        400,
        ERROR_CODES.READ_SEQUENCE_INVALID,
        "Read sequence cannot regress",
      );
    }

    if (input.requestedLastReadSequence > conversation.lastMessageSequence) {
      throw new AppException(
        400,
        ERROR_CODES.READ_SEQUENCE_INVALID,
        "Read sequence exceeds conversation max",
      );
    }
  }
}

@Injectable()
export class UnreadCounterService {
  derive(lastMessageSequence: number, lastReadSequence: number): number {
    return Math.max(0, lastMessageSequence - lastReadSequence);
  }
}

@Injectable()
export class ConversationParticipantPolicy {
  assertParticipant(
    userId: string,
    participantIds: [string, string],
  ): void {
    if (!participantIds.includes(userId)) {
      throw new AppException(
        403,
        ERROR_CODES.CONVERSATION_NOT_ACCESSIBLE,
        "Conversation is not accessible",
      );
    }
  }
}

```

FILE: src/modules/conversations/policies/conversations.policies.ts
```ts
export { ConversationParticipantPolicy } from "../domain/conversations.domain";

```

FILE: src/modules/conversations/events/conversations.events.ts
```ts
export const CONVERSATION_EVENTS = {
  READ_UPDATED: "conversation.read.updated",
  CLOSED: "conversation.closed",
} as const;

```

FILE: src/modules/conversations/infrastructure/conversations.infrastructure.ts
```ts
import { Injectable } from "@nestjs/common";
import { Buffer } from "node:buffer";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  Conversation,
  ConversationRead,
  Match,
  Message,
  ProfilePhoto,
  User,
  UserInterest,
  UserIntent,
  UserLifestyle,
  UserProfile,
} from "../../../generated/prisma/client";

type ConversationExecutor = PrismaService | PrismaTransactionalClient;

export interface ConversationProjection extends Conversation {
  match: Match & {
    userLow: User & {
      profile: UserProfile | null;
      photos: Pick<
        ProfilePhoto,
        "id" | "objectKey" | "bucket" | "width" | "height" | "isPrimary" | "position"
      >[];
      lifestyle: UserLifestyle | null;
      interests: (Pick<UserInterest, "interestTagId"> & {
        interestTag: {
          id: string;
          slug: string;
          displayName: string;
          category: string | null;
        };
      })[];
      intents: Pick<UserIntent, "intent">[];
    };
    userHigh: User & {
      profile: UserProfile | null;
      photos: Pick<
        ProfilePhoto,
        "id" | "objectKey" | "bucket" | "width" | "height" | "isPrimary" | "position"
      >[];
      lifestyle: UserLifestyle | null;
      interests: (Pick<UserInterest, "interestTagId"> & {
        interestTag: {
          id: string;
          slug: string;
          displayName: string;
          category: string | null;
        };
      })[];
      intents: Pick<UserIntent, "intent">[];
    };
  };
  reads: ConversationRead[];
}

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(
    userId: string,
    input: {
      cursor?: string;
      limit: number;
    },
  ): Promise<{
    items: ConversationProjection[];
    nextCursor: string | null;
  }> {
    const cursor = input.cursor ? decodeConversationCursor(input.cursor) : null;
    const items = (await this.prisma.conversation.findMany({
      where: {
        match: {
          OR: [{ userLowId: userId }, { userHighId: userId }],
        },
        ...(cursor
          ? {
              OR: [
                {
                  updatedAt: {
                    lt: new Date(cursor.updatedAt),
                  },
                },
                {
                  updatedAt: new Date(cursor.updatedAt),
                  id: {
                    lt: cursor.id,
                  },
                },
              ],
            }
          : {}),
      },
      include: conversationInclude(userId),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    })) as unknown as ConversationProjection[];

    const hasMore = items.length > input.limit;
    const pageItems = hasMore ? items.slice(0, input.limit) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems,
      nextCursor:
        hasMore && lastItem
          ? encodeConversationCursor({
              updatedAt: lastItem.updatedAt.toISOString(),
              id: lastItem.id,
            })
          : null,
    };
  }

  async findByIdForUser(
    conversationId: string,
    userId: string,
    executor?: ConversationExecutor,
  ): Promise<ConversationProjection | null> {
    const db = executor ?? this.prisma;

    return (db.conversation.findFirst({
      where: {
        id: conversationId,
        match: {
          OR: [{ userLowId: userId }, { userHighId: userId }],
        },
      },
      include: conversationInclude(userId),
    })) as unknown as Promise<ConversationProjection | null>;
  }

  async upsertForMatch(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
    },
  ): Promise<Conversation> {
    return executor.conversation.upsert({
      where: {
        matchId: input.matchId,
      },
      create: {
        matchId: input.matchId,
      },
      update: {},
    });
  }

  async closeForMatch(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
      status: "BLOCKED" | "CLOSED_UNMATCHED" | "CLOSED_MODERATION";
      closedReason: "BLOCKED" | "UNMATCHED" | "MODERATION" | "ACCOUNT_DELETED";
      closedAt: Date;
    },
  ): Promise<Conversation | null> {
    const existing = await executor.conversation.findUnique({
      where: {
        matchId: input.matchId,
      },
    });

    if (!existing) {
      return null;
    }

    return executor.conversation.update({
      where: {
        matchId: input.matchId,
      },
      data: {
        status: input.status,
        closedAt: input.closedAt,
        closedReason: input.closedReason,
      },
    });
  }
}

@Injectable()
export class ConversationReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertParticipantReadState(
    executor: PrismaTransactionalClient,
    input: {
      conversationId: string;
      userId: string;
    },
  ): Promise<ConversationRead> {
    return executor.conversationRead.upsert({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: input.userId,
        },
      },
      create: {
        conversationId: input.conversationId,
        userId: input.userId,
      },
      update: {},
    });
  }

  async updateReadState(
    executor: PrismaTransactionalClient,
    input: {
      conversationId: string;
      userId: string;
      lastReadMessageId: string | null;
      lastReadSequence: number;
      lastReadAt: Date;
    },
  ): Promise<ConversationRead> {
    return executor.conversationRead.update({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: input.userId,
        },
      },
      data: {
        lastReadMessageId: input.lastReadMessageId,
        lastReadSequence: input.lastReadSequence,
        lastReadAt: input.lastReadAt,
      },
    });
  }
}

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByConversation(
    conversationId: string,
    input: {
      cursor?: string;
      limit: number;
    },
  ): Promise<{
    items: Message[];
    nextCursor: string | null;
  }> {
    const cursor = input.cursor ? decodeMessageCursor(input.cursor) : null;
    const items = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor
          ? {
              sequence: {
                lt: cursor.sequence,
              },
            }
          : {}),
      },
      orderBy: {
        sequence: "desc",
      },
      take: input.limit + 1,
    });

    const hasMore = items.length > input.limit;
    const pageItems = hasMore ? items.slice(0, input.limit) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems,
      nextCursor:
        hasMore && lastItem
          ? encodeMessageCursor({
              sequence: lastItem.sequence,
            })
          : null,
    };
  }

  async findByConversationAndSequence(
    conversationId: string,
    sequence: number,
    executor?: ConversationExecutor,
  ): Promise<Pick<Message, "id" | "sequence"> | null> {
    const db = executor ?? this.prisma;

    return db.message.findUnique({
      where: {
        conversationId_sequence: {
          conversationId,
          sequence,
        },
      },
      select: {
        id: true,
        sequence: true,
      },
    });
  }
}

export function conversationInclude(userId: string) {
  return {
    reads: {
      where: {
        userId,
      },
    },
    match: {
      include: {
        userLow: userInclude(),
        userHigh: userInclude(),
      },
    },
  };
}

function userInclude() {
  return {
    include: {
      profile: true,
      photos: {
        where: {
          moderationStatus: "APPROVED" as const,
          deletedAt: null,
        },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
        select: {
          id: true,
          objectKey: true,
          bucket: true,
          width: true,
          height: true,
          isPrimary: true,
          position: true,
        },
      },
      lifestyle: true,
      interests: {
        where: {
          deletedAt: null,
        },
        select: {
          interestTagId: true,
          interestTag: {
            select: {
              id: true,
              slug: true,
              displayName: true,
              category: true,
            },
          },
        },
      },
      intents: {
        where: {
          deletedAt: null,
        },
        select: {
          intent: true,
        },
      },
    },
  };
}

function encodeConversationCursor(value: {
  updatedAt: string;
  id: string;
}): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeConversationCursor(cursor: string): {
  updatedAt: string;
  id: string;
} {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as {
      updatedAt?: string;
      id?: string;
    };

    if (typeof parsed.updatedAt !== "string" || typeof parsed.id !== "string") {
      throw new Error("Invalid conversation cursor");
    }

    return {
      updatedAt: parsed.updatedAt,
      id: parsed.id,
    };
  } catch {
    throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
  }
}

function encodeMessageCursor(value: { sequence: number }): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeMessageCursor(cursor: string): { sequence: number } {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as {
      sequence?: number;
    };

    if (typeof parsed.sequence !== "number") {
      throw new Error("Invalid message cursor");
    }

    return {
      sequence: parsed.sequence,
    };
  } catch {
    throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
  }
}

```

FILE: src/modules/conversations/application/conversations.services.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import {
  haversineDistanceKm,
  resolveDistanceBand,
} from "../../../common/utils/distance.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { PublicProfileDto } from "../../discovery/dto/discovery.dto";
import type {
  ConnectionIntentValue,
  DietPreferenceValue,
  DrinkingHabitValue,
  ExerciseHabitValue,
  PetPreferenceValue,
  SleepPatternValue,
  SmokingHabitValue,
  SocialEnergyValue,
} from "../../profiles/dto/profiles.dto";
import type {
  ConversationDetailResponseDto,
  ConversationPageDto,
  ConversationReadDto,
  ConversationReadResponseDto,
  ConversationSummaryDto,
  MessageDto,
  MessagePageDto,
} from "../dto/conversations.dto";
import {
  ConversationAccessPolicyService,
  UnreadCounterService,
} from "../domain/conversations.domain";
import {
  CONVERSATION_EVENTS,
} from "../events/conversations.events";
import {
  ConversationReadRepository,
  ConversationRepository,
  MessageRepository,
  type ConversationProjection,
} from "../infrastructure/conversations.infrastructure";

@Injectable()
export class ConversationReaderService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly unreadCounterService: UnreadCounterService,
  ) {}

  async getRequiredConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationProjection> {
    const conversation = await this.conversationRepository.findByIdForUser(
      conversationId,
      userId,
    );

    if (!conversation) {
      throw new AppException(
        404,
        ERROR_CODES.CONVERSATION_NOT_FOUND,
        "Conversation not found",
      );
    }

    return conversation;
  }

  mapConversationSummary(
    conversation: ConversationProjection,
    viewerUserId: string,
  ): ConversationSummaryDto {
    const otherUser =
      conversation.match.userLowId === viewerUserId
        ? conversation.match.userHigh
        : conversation.match.userLow;
    const viewerProfile =
      conversation.match.userLowId === viewerUserId
        ? conversation.match.userLow.profile
        : conversation.match.userHigh.profile;
    const readState = conversation.reads[0];

    return {
      id: conversation.id,
      matchId: conversation.matchId,
      status: conversation.status,
      otherUser: mapPublicProfile(viewerProfile, otherUser),
      lastMessageSequence: conversation.lastMessageSequence,
      lastMessagePreview: conversation.lastMessagePreview ?? null,
      lastMessageType: conversation.lastMessageType ?? null,
      lastMessageSentAt: conversation.lastMessageSentAt?.toISOString() ?? null,
      lastSenderId: conversation.lastSenderId ?? null,
      lastReadSequence: readState?.lastReadSequence ?? 0,
      unreadCount: this.unreadCounterService.derive(
        conversation.lastMessageSequence,
        readState?.lastReadSequence ?? 0,
      ),
      closedAt: conversation.closedAt?.toISOString() ?? null,
      closedReason: conversation.closedReason ?? null,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }
}

@Injectable()
export class ConversationArtifactService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationReadRepository: ConversationReadRepository,
  ) {}

  async ensureForMatch(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
      userLowId: string;
      userHighId: string;
    },
  ) {
    const conversation = await this.conversationRepository.upsertForMatch(
      executor,
      {
        matchId: input.matchId,
      },
    );

    await this.conversationReadRepository.upsertParticipantReadState(executor, {
      conversationId: conversation.id,
      userId: input.userLowId,
    });
    await this.conversationReadRepository.upsertParticipantReadState(executor, {
      conversationId: conversation.id,
      userId: input.userHighId,
    });

    return conversation;
  }
}

@Injectable()
export class ConversationCloserService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
  ) {}

  async closeForMatch(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
      status: "BLOCKED" | "CLOSED_UNMATCHED" | "CLOSED_MODERATION";
      closedReason: "BLOCKED" | "UNMATCHED" | "MODERATION" | "ACCOUNT_DELETED";
      closedAt: Date;
    },
  ) {
    return this.conversationRepository.closeForMatch(executor, input);
  }
}

@Injectable()
export class ListConversationsService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationReaderService: ConversationReaderService,
  ) {}

  async execute(input: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<ConversationPageDto> {
    const page = await this.conversationRepository.listByUser(input.userId, {
      cursor: input.cursor,
      limit: input.limit ?? 20,
    });

    return {
      items: page.items.map((conversation) =>
        this.conversationReaderService.mapConversationSummary(
          conversation,
          input.userId,
        ),
      ),
      nextCursor: page.nextCursor,
    };
  }
}

@Injectable()
export class GetConversationService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationAccessPolicyService: ConversationAccessPolicyService,
    private readonly conversationReaderService: ConversationReaderService,
  ) {}

  async execute(input: {
    userId: string;
    conversationId: string;
  }): Promise<ConversationDetailResponseDto> {
    const conversation = await this.conversationRepository.findByIdForUser(
      input.conversationId,
      input.userId,
    );

    this.conversationAccessPolicyService.assertReadable(conversation);
    this.conversationAccessPolicyService.assertParticipant(
      input.userId,
      conversation.match,
    );

    return {
      conversation: this.conversationReaderService.mapConversationSummary(
        conversation,
        input.userId,
      ),
    };
  }
}

@Injectable()
export class ListConversationMessagesService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly conversationAccessPolicyService: ConversationAccessPolicyService,
  ) {}

  async execute(input: {
    userId: string;
    conversationId: string;
    cursor?: string;
    limit?: number;
  }): Promise<MessagePageDto> {
    const conversation = await this.conversationRepository.findByIdForUser(
      input.conversationId,
      input.userId,
    );
    this.conversationAccessPolicyService.assertReadable(conversation);
    this.conversationAccessPolicyService.assertParticipant(
      input.userId,
      conversation.match,
    );

    const page = await this.messageRepository.listByConversation(
      input.conversationId,
      {
        cursor: input.cursor,
        limit: input.limit ?? 50,
      },
    );

    return {
      items: page.items.map(mapMessageDto),
      nextCursor: page.nextCursor,
    };
  }
}

@Injectable()
export class MarkConversationReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationReadRepository: ConversationReadRepository,
    private readonly messageRepository: MessageRepository,
    private readonly conversationAccessPolicyService: ConversationAccessPolicyService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: {
    userId: string;
    conversationId: string;
    lastReadSequence: number;
  }): Promise<ConversationReadResponseDto> {
    const conversation = await this.conversationRepository.findByIdForUser(
      input.conversationId,
      input.userId,
    );

    this.conversationAccessPolicyService.assertReadable(conversation);
    this.conversationAccessPolicyService.assertParticipant(
      input.userId,
      conversation.match,
    );

    const currentReadState = conversation.reads[0];
    this.conversationAccessPolicyService.assertCanUpdateReadState(
      conversation,
      conversation.match,
      {
        currentLastReadSequence: currentReadState?.lastReadSequence ?? 0,
        requestedLastReadSequence: input.lastReadSequence,
      },
    );

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const lastReadMessage =
        input.lastReadSequence > 0
          ? await this.messageRepository.findByConversationAndSequence(
              input.conversationId,
              input.lastReadSequence,
              tx,
            )
          : null;

      const readState = await this.conversationReadRepository.updateReadState(tx, {
        conversationId: input.conversationId,
        userId: input.userId,
        lastReadMessageId: lastReadMessage?.id ?? null,
        lastReadSequence: input.lastReadSequence,
        lastReadAt: now,
      });

      return readState;
    });

    await this.domainEventPublisher.publish(CONVERSATION_EVENTS.READ_UPDATED, {
      conversationId: input.conversationId,
      readState: mapConversationReadDto(result),
    });

    return {
      readState: mapConversationReadDto(result),
    };
  }
}

function mapMessageDto(message: {
  id: string;
  conversationId: string;
  senderId: string;
  sequence: number;
  clientMessageId: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SYSTEM";
  textBody: string | null;
  attachmentObjectKey: string | null;
  attachmentBucket: string | null;
  attachmentMimeType: string | null;
  attachmentSizeBytes: number | null;
  attachmentWidth: number | null;
  attachmentHeight: number | null;
  attachmentDurationSeconds: number | null;
  attachmentModerationStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  status:
    | "ACTIVE"
    | "PENDING_MODERATION"
    | "REMOVED_BY_MODERATION"
    | "DELETED_BY_SENDER";
  replyToMessageId: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): MessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    sequence: message.sequence,
    clientMessageId: message.clientMessageId ?? null,
    type: message.type,
    textBody: message.textBody ?? null,
    attachment: {
      objectKey: message.attachmentObjectKey ?? null,
      url:
        message.attachmentBucket && message.attachmentObjectKey
          ? `s3://${message.attachmentBucket}/${message.attachmentObjectKey}`
          : null,
      mimeType: message.attachmentMimeType ?? null,
      sizeBytes: message.attachmentSizeBytes ?? null,
      width: message.attachmentWidth ?? null,
      height: message.attachmentHeight ?? null,
      durationSeconds: message.attachmentDurationSeconds ?? null,
      moderationStatus: message.attachmentModerationStatus ?? null,
    },
    status: message.status,
    replyToMessageId: message.replyToMessageId ?? null,
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedAt: message.deletedAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

function mapConversationReadDto(readState: {
  conversationId: string;
  userId: string;
  lastReadMessageId: string | null;
  lastReadSequence: number;
  lastReadAt: Date | null;
}): ConversationReadDto {
  return {
    conversationId: readState.conversationId,
    userId: readState.userId,
    lastReadMessageId: readState.lastReadMessageId ?? null,
    lastReadSequence: readState.lastReadSequence,
    lastReadAt: (readState.lastReadAt ?? new Date()).toISOString(),
  };
}

function mapPublicProfile(
  viewerProfile: {
    locationLat: { toString(): string } | null;
    locationLng: { toString(): string } | null;
  } | null,
  user: {
    id: string;
    profile: {
      displayName: string | null;
      headline: string | null;
      bio: string | null;
      dateOfBirth: Date | null;
      gender: PublicProfileDto["gender"];
      pronouns: string | null;
      city: string | null;
      region: string | null;
      countryCode: string | null;
      hideDistance: boolean;
      locationLat: { toString(): string } | null;
      locationLng: { toString(): string } | null;
    } | null;
    interests: Array<{
      interestTag: {
        id: string;
        slug: string;
        displayName: string;
        category: string | null;
      };
    }>;
    intents: Array<{
      intent: ConnectionIntentValue;
    }>;
    lifestyle: {
      smoking: SmokingHabitValue | null;
      drinking: DrinkingHabitValue | null;
      exercise: ExerciseHabitValue | null;
      diet: DietPreferenceValue | null;
      petPreference: PetPreferenceValue | null;
      sleepPattern: SleepPatternValue | null;
      socialEnergy: SocialEnergyValue | null;
    } | null;
    photos: Array<{
      id: string;
      objectKey: string;
      bucket: string;
      width: number | null;
      height: number | null;
      isPrimary: boolean;
      position: number;
    }>;
  },
): PublicProfileDto {
  const profile = user.profile;
  const distanceKm =
    !profile?.hideDistance &&
    viewerProfile?.locationLat &&
    viewerProfile.locationLng &&
    profile?.locationLat &&
    profile.locationLng
      ? haversineDistanceKm(
          Number(viewerProfile.locationLat.toString()),
          Number(viewerProfile.locationLng.toString()),
          Number(profile.locationLat.toString()),
          Number(profile.locationLng.toString()),
        )
      : null;

  return {
    userId: user.id,
    displayName: profile?.displayName ?? "Unknown",
    headline: profile?.headline ?? null,
    bio: profile?.bio ?? null,
    age: profile?.dateOfBirth ? calculateAge(profile.dateOfBirth) : 0,
    gender: profile?.gender ?? null,
    pronouns: profile?.pronouns ?? null,
    location: {
      city: profile?.city ?? null,
      region: profile?.region ?? null,
      countryCode: profile?.countryCode ?? null,
      distanceKmRounded: distanceKm === null ? 0 : Math.round(distanceKm),
      distanceBand: distanceKm === null ? null : resolveDistanceBand(distanceKm),
    },
    intents: user.intents.map((intent) => intent.intent),
    interests: user.interests.map((interest) => ({
      id: interest.interestTag.id,
      slug: interest.interestTag.slug,
      displayName: interest.interestTag.displayName,
      category: interest.interestTag.category,
    })),
    lifestyle: {
      smoking: user.lifestyle?.smoking ?? null,
      drinking: user.lifestyle?.drinking ?? null,
      exercise: user.lifestyle?.exercise ?? null,
      diet: user.lifestyle?.diet ?? null,
      petPreference: user.lifestyle?.petPreference ?? null,
      sleepPattern: user.lifestyle?.sleepPattern ?? null,
      socialEnergy: user.lifestyle?.socialEnergy ?? null,
    },
    photos: user.photos.map((photo) => ({
      id: photo.id,
      url: `s3://${photo.bucket}/${photo.objectKey}`,
      width: photo.width,
      height: photo.height,
      isPrimary: photo.isPrimary,
      position: photo.position,
    })),
  };
}


function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDifference = today.getUTCMonth() - dateOfBirth.getUTCMonth();
  const dayDifference = today.getUTCDate() - dateOfBirth.getUTCDate();

  if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
    age -= 1;
  }

  return age;
}

```

FILE: src/modules/conversations/controllers/conversations.controller.ts
```ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CursorPageQueryDto } from "../../../common/dto/cursor-page-query.dto";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  GetConversationService,
  ListConversationMessagesService,
  ListConversationsService,
  MarkConversationReadService,
} from "../application/conversations.services";
import {
  ConversationMessagePageQueryDto,
  ConversationReadRequestDto,
  type ConversationDetailResponseDto,
  type ConversationPageDto,
  type ConversationReadResponseDto,
  type MessagePageDto,
} from "../dto/conversations.dto";

@Controller("conversations")
export class ConversationsController {
  constructor(
    private readonly listConversationsService: ListConversationsService,
    private readonly getConversationService: GetConversationService,
    private readonly listConversationMessagesService: ListConversationMessagesService,
    private readonly markConversationReadService: MarkConversationReadService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthContext["user"],
    @Query() query: CursorPageQueryDto,
  ): Promise<ConversationPageDto> {
    return this.listConversationsService.execute({
      userId: user.id,
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 50) : 20,
    });
  }

  @Get(":conversationId")
  async getById(
    @CurrentUser() user: AuthContext["user"],
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
  ): Promise<ConversationDetailResponseDto> {
    return this.getConversationService.execute({
      userId: user.id,
      conversationId,
    });
  }

  @Get(":conversationId/messages")
  async listMessages(
    @CurrentUser() user: AuthContext["user"],
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Query() query: ConversationMessagePageQueryDto,
  ): Promise<MessagePageDto> {
    return this.listConversationMessagesService.execute({
      userId: user.id,
      conversationId,
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 100) : 50,
    });
  }

  @Post(":conversationId/read")
  async markRead(
    @CurrentUser() user: AuthContext["user"],
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() body: ConversationReadRequestDto,
  ): Promise<ConversationReadResponseDto> {
    return this.markConversationReadService.execute({
      userId: user.id,
      conversationId,
      lastReadSequence: body.lastReadSequence,
    });
  }
}

```

FILE: src/modules/conversations/conversations.module.ts
```ts
import { Module } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { ConversationsController } from "./controllers/conversations.controller";
import {
  ConversationArtifactService,
  ConversationCloserService,
  ConversationReaderService,
  GetConversationService,
  ListConversationMessagesService,
  ListConversationsService,
  MarkConversationReadService,
} from "./application/conversations.services";
import {
  ConversationAccessPolicyService,
  ConversationParticipantPolicy,
  UnreadCounterService,
} from "./domain/conversations.domain";
import {
  ConversationReadRepository,
  ConversationRepository,
  MessageRepository,
} from "./infrastructure/conversations.infrastructure";

@Module({
  controllers: [ConversationsController],
  providers: [
    AppLogger,
    DomainEventPublisher,
    ConversationReaderService,
    ConversationArtifactService,
    ConversationCloserService,
    ListConversationsService,
    GetConversationService,
    ListConversationMessagesService,
    MarkConversationReadService,
    ConversationAccessPolicyService,
    ConversationParticipantPolicy,
    UnreadCounterService,
    ConversationRepository,
    ConversationReadRepository,
    MessageRepository,
  ],
  exports: [
    ConversationReaderService,
    ConversationArtifactService,
    ConversationCloserService,
    ConversationAccessPolicyService,
  ],
})
export class ConversationsModule {}

```

FILE: src/modules/matches/dto/matches.dto.ts
```ts
import { Transform } from "class-transformer";
import { IsBoolean } from "class-validator";
import type { PublicProfileDto } from "../../discovery/dto/discovery.dto";

export interface MatchCommunicationSettingDto {
  matchId: string;
  userId: string;
  allowVoiceCalls: boolean;
  allowVideoCalls: boolean;
  muted: boolean;
  updatedAt: string;
}

export interface MatchSummaryDto {
  id: string;
  status: "ACTIVE" | "ENDED";
  matchedAt: string;
  endedAt: string | null;
  endedReason: "UNMATCHED" | "BLOCKED" | "MODERATION" | "ACCOUNT_DELETED" | null;
  otherUser: PublicProfileDto;
  conversationId: string | null;
  myCommunicationSetting: MatchCommunicationSettingDto;
  lastMessagePreview: string | null;
  lastMessageSentAt: string | null;
}

export interface MatchDetailDto extends MatchSummaryDto {
  otherUserCommunicationAllowed: {
    allowVoiceCalls: boolean;
    allowVideoCalls: boolean;
  };
}

export interface MatchPageDto {
  items: MatchSummaryDto[];
  nextCursor: string | null;
}

export interface MatchDetailResponseDto {
  match: MatchDetailDto;
}

export interface EndMatchResponseDto {
  match: MatchSummaryDto;
}

export class UpdateMyMatchCommunicationSettingDto {
  @Transform(({ value }) => Boolean(value))
  @IsBoolean()
  readonly allowVoiceCalls!: boolean;

  @Transform(({ value }) => Boolean(value))
  @IsBoolean()
  readonly allowVideoCalls!: boolean;

  @Transform(({ value }) => Boolean(value))
  @IsBoolean()
  readonly muted!: boolean;
}

export interface UpdateMyMatchCommunicationSettingResponseDto {
  setting: MatchCommunicationSettingDto;
}

```

FILE: src/modules/matches/domain/matches.domain.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { Match, MatchCommunicationSetting } from "../../../generated/prisma/client";

@Injectable()
export class MatchParticipantPolicy {
  assertParticipant(
    userId: string,
    match:
      | Pick<Match, "userLowId" | "userHighId">
      | null,
  ): asserts match is Pick<Match, "userLowId" | "userHighId"> {
    if (!match || (match.userLowId !== userId && match.userHighId !== userId)) {
      throw new AppException(404, ERROR_CODES.MATCH_NOT_FOUND, "Match not found");
    }
  }
}

@Injectable()
export class MatchPolicyService {
  assertReadable<TMatch extends Pick<Match, "userLowId" | "userHighId">>(
    match: TMatch | null,
    userId: string,
  ): asserts match is TMatch {
    if (!match || (match.userLowId !== userId && match.userHighId !== userId)) {
      throw new AppException(404, ERROR_CODES.MATCH_NOT_FOUND, "Match not found");
    }
  }

  assertActive(match: Pick<Match, "status">): void {
    if (match.status !== "ACTIVE") {
      throw new AppException(
        409,
        ERROR_CODES.MATCH_NOT_ACTIVE,
        "Match is no longer active",
      );
    }
  }
}

@Injectable()
export class MatchCommunicationPolicyService {
  assertManageable(match: Pick<Match, "status">): void {
    if (match.status !== "ACTIVE") {
      throw new AppException(
        409,
        ERROR_CODES.MATCH_NOT_ACTIVE,
        "Match is no longer active",
      );
    }
  }

  assertOwnedByUser(
    userId: string,
    setting:
      | Pick<MatchCommunicationSetting, "userId">
      | null,
  ): asserts setting is Pick<MatchCommunicationSetting, "userId"> {
    if (!setting || setting.userId !== userId) {
      throw new AppException(404, ERROR_CODES.MATCH_NOT_FOUND, "Match not found");
    }
  }
}

```

FILE: src/modules/matches/policies/matches.policies.ts
```ts
export {
  MatchCommunicationPolicyService,
  MatchParticipantPolicy,
  MatchPolicyService,
} from "../domain/matches.domain";

```

FILE: src/modules/matches/events/matches.events.ts
```ts
export const MATCH_EVENTS = {
  CREATED: "match.created",
  ENDED: "match.ended",
  COMMUNICATION_SETTING_UPDATED: "match.communication-setting.updated",
} as const;

```

FILE: src/modules/matches/infrastructure/matches.infrastructure.ts
```ts
import { Injectable } from "@nestjs/common";
import { Buffer } from "node:buffer";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  Conversation,
  Match,
  MatchCommunicationSetting,
  ProfilePhoto,
  User,
  UserInterest,
  UserIntent,
  UserLifestyle,
  UserProfile,
} from "../../../generated/prisma/client";

type MatchExecutor = PrismaService | PrismaTransactionalClient;

export interface MatchProjection extends Match {
  conversation: Pick<
    Conversation,
    | "id"
    | "status"
    | "lastMessagePreview"
    | "lastMessageSentAt"
    | "closedAt"
    | "closedReason"
  > | null;
  communicationSettings: MatchCommunicationSetting[];
  userLow: User & MatchUserRelations;
  userHigh: User & MatchUserRelations;
}

interface MatchUserRelations {
  profile: UserProfile | null;
  photos: Pick<
    ProfilePhoto,
    "id" | "objectKey" | "bucket" | "width" | "height" | "isPrimary" | "position"
  >[];
  lifestyle: UserLifestyle | null;
  interests: (Pick<UserInterest, "interestTagId"> & {
    interestTag: {
      id: string;
      slug: string;
      displayName: string;
      category: string | null;
    };
  })[];
  intents: Pick<UserIntent, "intent">[];
}

@Injectable()
export class MatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(
    userId: string,
    input: {
      cursor?: string;
      limit: number;
    },
  ): Promise<{
    items: MatchProjection[];
    nextCursor: string | null;
  }> {
    const cursor = input.cursor ? decodeMatchCursor(input.cursor) : null;
    const items = (await this.prisma.match.findMany({
      where: {
        OR: [{ userLowId: userId }, { userHighId: userId }],
        ...(cursor
          ? {
              OR: [
                {
                  matchedAt: {
                    lt: new Date(cursor.matchedAt),
                  },
                },
                {
                  matchedAt: new Date(cursor.matchedAt),
                  id: {
                    lt: cursor.id,
                  },
                },
              ],
            }
          : {}),
      },
      include: matchInclude(),
      orderBy: [{ matchedAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    })) as unknown as MatchProjection[];

    const hasMore = items.length > input.limit;
    const pageItems = hasMore ? items.slice(0, input.limit) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems,
      nextCursor:
        hasMore && lastItem
          ? encodeMatchCursor({
              matchedAt: lastItem.matchedAt.toISOString(),
              id: lastItem.id,
            })
          : null,
    };
  }

  async findByIdForUser(
    matchId: string,
    userId: string,
    executor?: MatchExecutor,
  ): Promise<MatchProjection | null> {
    const db = executor ?? this.prisma;

    return (db.match.findFirst({
      where: {
        id: matchId,
        OR: [{ userLowId: userId }, { userHighId: userId }],
      },
      include: matchInclude(),
    })) as unknown as Promise<MatchProjection | null>;
  }

  async findById(
    matchId: string,
    executor?: MatchExecutor,
  ): Promise<Match | null> {
    const db = executor ?? this.prisma;

    return db.match.findUnique({
      where: {
        id: matchId,
      },
    });
  }

  async findByPair(
    userLowId: string,
    userHighId: string,
    executor?: MatchExecutor,
  ): Promise<Match | null> {
    const db = executor ?? this.prisma;

    return db.match.findUnique({
      where: {
        userLowId_userHighId: {
          userLowId,
          userHighId,
        },
      },
    });
  }

  async create(
    executor: PrismaTransactionalClient,
    input: {
      userLowId: string;
      userHighId: string;
      matchedAt: Date;
    },
  ): Promise<Match> {
    return executor.match.create({
      data: {
        userLowId: input.userLowId,
        userHighId: input.userHighId,
        matchedAt: input.matchedAt,
      },
    });
  }

  async end(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
      endedAt: Date;
      endedByUserId: string;
      endedReason: "UNMATCHED" | "BLOCKED" | "MODERATION" | "ACCOUNT_DELETED";
    },
  ): Promise<Match> {
    return executor.match.update({
      where: {
        id: input.matchId,
      },
      data: {
        status: "ENDED",
        endedAt: input.endedAt,
        endedByUserId: input.endedByUserId,
        endedReason: input.endedReason,
      },
    });
  }
}

@Injectable()
export class MatchCommunicationSettingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertDefaults(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
      userIds: [string, string];
    },
  ): Promise<MatchCommunicationSetting[]> {
    const settings: MatchCommunicationSetting[] = [];

    for (const userId of input.userIds) {
      const setting = await executor.matchCommunicationSetting.upsert({
        where: {
          matchId_userId: {
            matchId: input.matchId,
            userId,
          },
        },
        create: {
          matchId: input.matchId,
          userId,
        },
        update: {},
      });
      settings.push(setting);
    }

    return settings;
  }

  async updateForUser(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
      userId: string;
      allowVoiceCalls: boolean;
      allowVideoCalls: boolean;
      muted: boolean;
    },
  ): Promise<MatchCommunicationSetting> {
    return executor.matchCommunicationSetting.upsert({
      where: {
        matchId_userId: {
          matchId: input.matchId,
          userId: input.userId,
        },
      },
      create: {
        matchId: input.matchId,
        userId: input.userId,
        allowVoiceCalls: input.allowVoiceCalls,
        allowVideoCalls: input.allowVideoCalls,
        muted: input.muted,
      },
      update: {
        allowVoiceCalls: input.allowVoiceCalls,
        allowVideoCalls: input.allowVideoCalls,
        muted: input.muted,
      },
    });
  }
}

function matchInclude() {
  return {
    conversation: {
      select: {
        id: true,
        status: true,
        lastMessagePreview: true,
        lastMessageSentAt: true,
        closedAt: true,
        closedReason: true,
      },
    },
    communicationSettings: true,
    userLow: userInclude(),
    userHigh: userInclude(),
  };
}

function userInclude() {
  return {
    include: {
      profile: true,
      photos: {
        where: {
          moderationStatus: "APPROVED" as const,
          deletedAt: null,
        },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
        select: {
          id: true,
          objectKey: true,
          bucket: true,
          width: true,
          height: true,
          isPrimary: true,
          position: true,
        },
      },
      lifestyle: true,
      interests: {
        where: {
          deletedAt: null,
        },
        select: {
          interestTagId: true,
          interestTag: {
            select: {
              id: true,
              slug: true,
              displayName: true,
              category: true,
            },
          },
        },
      },
      intents: {
        where: {
          deletedAt: null,
        },
        select: {
          intent: true,
        },
      },
    },
  };
}

function encodeMatchCursor(value: {
  matchedAt: string;
  id: string;
}): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeMatchCursor(cursor: string): {
  matchedAt: string;
  id: string;
} {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as {
      matchedAt?: string;
      id?: string;
    };

    if (typeof parsed.matchedAt !== "string" || typeof parsed.id !== "string") {
      throw new Error("Invalid match cursor");
    }

    return {
      matchedAt: parsed.matchedAt,
      id: parsed.id,
    };
  } catch {
    throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
  }
}

```

FILE: src/modules/matches/application/matches.services.ts
```ts
import { Injectable } from "@nestjs/common";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import {
  haversineDistanceKm,
  resolveDistanceBand,
} from "../../../common/utils/distance.util";
import { canonicalUserPair } from "../../../common/utils/pair.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  Match,
  MatchCommunicationSetting,
  ProfilePhoto,
  User,
  UserInterest,
  UserIntent,
  UserLifestyle,
  UserProfile,
} from "../../../generated/prisma/client";
import { InvalidateDiscoverySnapshotService } from "../../discovery/application/discovery.services";
import type { PublicProfileDto } from "../../discovery/dto/discovery.dto";
import {
  ConversationArtifactService,
  ConversationCloserService,
} from "../../conversations/application/conversations.services";
import {
  CONVERSATION_EVENTS,
} from "../../conversations/events/conversations.events";
import type {
  EndMatchResponseDto,
  MatchCommunicationSettingDto,
  MatchDetailDto,
  MatchDetailResponseDto,
  MatchPageDto,
  MatchSummaryDto,
  UpdateMyMatchCommunicationSettingDto,
  UpdateMyMatchCommunicationSettingResponseDto,
} from "../dto/matches.dto";
import {
  MatchCommunicationPolicyService,
  MatchParticipantPolicy,
  MatchPolicyService,
} from "../domain/matches.domain";
import { MATCH_EVENTS } from "../events/matches.events";
import {
  MatchCommunicationSettingRepository,
  MatchRepository,
  type MatchProjection,
} from "../infrastructure/matches.infrastructure";

type MatchUserProjection = User & {
  profile: UserProfile | null;
  photos: Pick<
    ProfilePhoto,
    "id" | "objectKey" | "bucket" | "width" | "height" | "isPrimary" | "position"
  >[];
  lifestyle: UserLifestyle | null;
  interests: (Pick<UserInterest, "interestTagId"> & {
    interestTag: {
      id: string;
      slug: string;
      displayName: string;
      category: string | null;
    };
  })[];
  intents: Pick<UserIntent, "intent">[];
};

export interface MatchActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface MatchArtifactsResult {
  match: Match;
  conversationId: string;
  created: boolean;
}

@Injectable()
export class MatchReaderService {
  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly matchPolicyService: MatchPolicyService,
  ) {}

  async getRequiredMatch(
    matchId: string,
    userId: string,
  ): Promise<MatchProjection> {
    const match = await this.matchRepository.findByIdForUser(matchId, userId);
    this.matchPolicyService.assertReadable(match, userId);
    return match;
  }

  mapSummary(match: MatchProjection, viewerUserId: string): MatchSummaryDto {
    const otherUser = resolveOtherUser(match, viewerUserId);
    const viewer = resolveViewerUser(match, viewerUserId);
    const mySetting = resolveCommunicationSetting(
      match,
      viewerUserId,
      match.updatedAt,
    );

    return {
      id: match.id,
      status: match.status,
      matchedAt: match.matchedAt.toISOString(),
      endedAt: match.endedAt?.toISOString() ?? null,
      endedReason: match.endedReason ?? null,
      otherUser: mapPublicProfile(viewer.profile, otherUser),
      conversationId: match.conversation?.id ?? null,
      myCommunicationSetting: mapMatchCommunicationSettingDto(mySetting),
      lastMessagePreview: match.conversation?.lastMessagePreview ?? null,
      lastMessageSentAt: match.conversation?.lastMessageSentAt?.toISOString() ?? null,
    };
  }

  mapDetail(match: MatchProjection, viewerUserId: string): MatchDetailDto {
    const summary = this.mapSummary(match, viewerUserId);
    const otherUser = resolveOtherUser(match, viewerUserId);
    const otherSetting = resolveCommunicationSetting(
      match,
      otherUser.id,
      match.updatedAt,
    );

    return {
      ...summary,
      otherUserCommunicationAllowed: {
        allowVoiceCalls: otherSetting.allowVoiceCalls,
        allowVideoCalls: otherSetting.allowVideoCalls,
      },
    };
  }
}

@Injectable()
export class CreateMatchArtifactsService {
  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly matchCommunicationSettingRepository: MatchCommunicationSettingRepository,
    private readonly conversationArtifactService: ConversationArtifactService,
  ) {}

  async execute(
    executor: PrismaTransactionalClient,
    input: {
      actorId: string;
      targetId: string;
      matchedAt: Date;
    },
  ): Promise<MatchArtifactsResult> {
    const pair = canonicalUserPair(input.actorId, input.targetId);
    let match = await this.matchRepository.findByPair(
      pair.userLowId,
      pair.userHighId,
      executor,
    );
    let created = false;

    if (!match) {
      match = await this.matchRepository.create(executor, {
        userLowId: pair.userLowId,
        userHighId: pair.userHighId,
        matchedAt: input.matchedAt,
      });
      created = true;
    }

    const conversation = await this.conversationArtifactService.ensureForMatch(
      executor,
      {
        matchId: match.id,
        userLowId: pair.userLowId,
        userHighId: pair.userHighId,
      },
    );

    await this.matchCommunicationSettingRepository.upsertDefaults(executor, {
      matchId: match.id,
      userIds: [pair.userLowId, pair.userHighId],
    });

    return {
      match,
      conversationId: conversation.id,
      created,
    };
  }
}

@Injectable()
export class ListMatchesService {
  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly matchReaderService: MatchReaderService,
  ) {}

  async execute(input: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<MatchPageDto> {
    const page = await this.matchRepository.listByUser(input.userId, {
      cursor: input.cursor,
      limit: input.limit ?? 20,
    });

    return {
      items: page.items.map((match) =>
        this.matchReaderService.mapSummary(match, input.userId),
      ),
      nextCursor: page.nextCursor,
    };
  }
}

@Injectable()
export class GetMatchService {
  constructor(private readonly matchReaderService: MatchReaderService) {}

  async execute(input: {
    userId: string;
    matchId: string;
  }): Promise<MatchDetailResponseDto> {
    const match = await this.matchReaderService.getRequiredMatch(
      input.matchId,
      input.userId,
    );

    return {
      match: this.matchReaderService.mapDetail(match, input.userId),
    };
  }
}

@Injectable()
export class EndMatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchRepository: MatchRepository,
    private readonly matchReaderService: MatchReaderService,
    private readonly matchPolicyService: MatchPolicyService,
    private readonly matchParticipantPolicy: MatchParticipantPolicy,
    private readonly conversationCloserService: ConversationCloserService,
    private readonly discoveryInvalidationService: InvalidateDiscoverySnapshotService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    matchId: string;
    metadata: MatchActionMetadata;
  }): Promise<EndMatchResponseDto> {
    const current = await this.matchRepository.findByIdForUser(
      input.matchId,
      input.userId,
    );
    this.matchPolicyService.assertReadable(current, input.userId);
    this.matchParticipantPolicy.assertParticipant(input.userId, current);

    if (current.status === "ACTIVE") {
      const now = new Date();
      await this.prisma.$transaction(async (tx) => {
        await this.matchRepository.end(tx, {
          matchId: current.id,
          endedAt: now,
          endedByUserId: input.userId,
          endedReason: "UNMATCHED",
        });

        const closedConversation = await this.conversationCloserService.closeForMatch(
          tx,
          {
            matchId: current.id,
            status: "CLOSED_UNMATCHED",
            closedReason: "UNMATCHED",
            closedAt: now,
          },
        );

        await this.auditLogService.write(
          {
            actorUserId: input.userId,
            action: "match.end",
            entityType: "Match",
            entityId: current.id,
            targetUserId:
              current.userLowId === input.userId ? current.userHighId : current.userLowId,
            ipAddress: input.metadata.ipAddress,
            userAgent: input.metadata.userAgent,
            metadata: {
              conversationId: closedConversation?.id ?? null,
            },
          },
          tx,
        );
      });

      await this.discoveryInvalidationService.execute(current.userLowId);
      await this.discoveryInvalidationService.execute(current.userHighId);
      await this.domainEventPublisher.publish(MATCH_EVENTS.ENDED, {
        matchId: current.id,
        endedByUserId: input.userId,
        userLowId: current.userLowId,
        userHighId: current.userHighId,
        endedReason: "UNMATCHED",
      });
      if (current.conversation?.id) {
        await this.domainEventPublisher.publish(CONVERSATION_EVENTS.CLOSED, {
          conversationId: current.conversation.id,
          matchId: current.id,
          status: "CLOSED_UNMATCHED",
          closedReason: "UNMATCHED",
        });
      }
    }

    const updated = await this.matchReaderService.getRequiredMatch(
      input.matchId,
      input.userId,
    );

    return {
      match: this.matchReaderService.mapSummary(updated, input.userId),
    };
  }
}

@Injectable()
export class UpdateMatchCommunicationSettingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchRepository: MatchRepository,
    private readonly matchPolicyService: MatchPolicyService,
    private readonly matchCommunicationPolicyService: MatchCommunicationPolicyService,
    private readonly matchCommunicationSettingRepository: MatchCommunicationSettingRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    matchId: string;
    payload: UpdateMyMatchCommunicationSettingDto;
    metadata: MatchActionMetadata;
  }): Promise<UpdateMyMatchCommunicationSettingResponseDto> {
    const match = await this.matchRepository.findByIdForUser(
      input.matchId,
      input.userId,
    );
    this.matchPolicyService.assertReadable(match, input.userId);
    this.matchCommunicationPolicyService.assertManageable(match);

    const setting = await this.prisma.$transaction(async (tx) => {
      const updatedSetting =
        await this.matchCommunicationSettingRepository.updateForUser(tx, {
          matchId: input.matchId,
          userId: input.userId,
          allowVoiceCalls: input.payload.allowVoiceCalls,
          allowVideoCalls: input.payload.allowVideoCalls,
          muted: input.payload.muted,
        });

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "match.communication-setting.update",
          entityType: "MatchCommunicationSetting",
          entityId: updatedSetting.id,
          targetUserId:
            match.userLowId === input.userId ? match.userHighId : match.userLowId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return updatedSetting;
    });

    const dto = mapMatchCommunicationSettingDto(setting);
    await this.domainEventPublisher.publish(
      MATCH_EVENTS.COMMUNICATION_SETTING_UPDATED,
      {
        matchId: input.matchId,
        userId: input.userId,
        setting: dto,
      },
    );

    return {
      setting: dto,
    };
  }
}

function resolveOtherUser(
  match: MatchProjection,
  viewerUserId: string,
): MatchUserProjection {
  return match.userLowId === viewerUserId ? match.userHigh : match.userLow;
}

function resolveViewerUser(
  match: MatchProjection,
  viewerUserId: string,
): MatchUserProjection {
  return match.userLowId === viewerUserId ? match.userLow : match.userHigh;
}

function resolveCommunicationSetting(
  match: Pick<
    MatchProjection,
    "id" | "communicationSettings"
  >,
  userId: string,
  fallbackUpdatedAt: Date,
): MatchCommunicationSetting {
  const existing = match.communicationSettings.find(
    (setting) => setting.userId === userId,
  );

  if (existing) {
    return existing;
  }

  return {
    id: `synthetic-${match.id}-${userId}`,
    matchId: match.id,
    userId,
    allowVoiceCalls: true,
    allowVideoCalls: true,
    muted: false,
    createdAt: fallbackUpdatedAt,
    updatedAt: fallbackUpdatedAt,
  };
}

function mapMatchCommunicationSettingDto(
  setting: Pick<
    MatchCommunicationSetting,
    "matchId" | "userId" | "allowVoiceCalls" | "allowVideoCalls" | "muted" | "updatedAt"
  >,
): MatchCommunicationSettingDto {
  return {
    matchId: setting.matchId,
    userId: setting.userId,
    allowVoiceCalls: setting.allowVoiceCalls,
    allowVideoCalls: setting.allowVideoCalls,
    muted: setting.muted,
    updatedAt: setting.updatedAt.toISOString(),
  };
}

function mapPublicProfile(
  viewerProfile: UserProfile | null,
  otherUser: MatchUserProjection,
): PublicProfileDto {
  const otherProfile = otherUser.profile;
  const distance = resolveLocationSummary(viewerProfile, otherProfile);

  return {
    userId: otherUser.id,
    displayName: otherProfile?.displayName ?? "Unknown",
    headline: otherProfile?.headline ?? null,
    bio: otherProfile?.bio ?? null,
    age: otherProfile?.dateOfBirth ? calculateAge(otherProfile.dateOfBirth) : 0,
    gender: otherProfile?.gender ?? null,
    pronouns: otherProfile?.pronouns ?? null,
    location: distance,
    intents: otherUser.intents.map((intent) => intent.intent),
    interests: otherUser.interests.map((interest) => ({
      id: interest.interestTag.id,
      slug: interest.interestTag.slug,
      displayName: interest.interestTag.displayName,
      category: interest.interestTag.category,
    })),
    lifestyle: {
      smoking: otherUser.lifestyle?.smoking ?? null,
      drinking: otherUser.lifestyle?.drinking ?? null,
      exercise: otherUser.lifestyle?.exercise ?? null,
      diet: otherUser.lifestyle?.diet ?? null,
      petPreference: otherUser.lifestyle?.petPreference ?? null,
      sleepPattern: otherUser.lifestyle?.sleepPattern ?? null,
      socialEnergy: otherUser.lifestyle?.socialEnergy ?? null,
    },
    photos: otherUser.photos.map((photo) => ({
      id: photo.id,
      url: `s3://${photo.bucket}/${photo.objectKey}`,
      width: photo.width ?? null,
      height: photo.height ?? null,
      isPrimary: photo.isPrimary,
      position: photo.position,
    })),
  };
}

function resolveLocationSummary(
  viewerProfile: UserProfile | null,
  otherProfile: UserProfile | null,
): PublicProfileDto["location"] {
  if (
    !otherProfile ||
    otherProfile.hideDistance ||
    !viewerProfile?.locationLat ||
    !viewerProfile.locationLng ||
    otherProfile.locationLat === null ||
    otherProfile.locationLng === null
  ) {
    return {
      city: otherProfile?.city ?? null,
      region: otherProfile?.region ?? null,
      countryCode: otherProfile?.countryCode ?? null,
      distanceKmRounded: 0,
      distanceBand: null,
    };
  }

  const distanceKm = Math.round(
    haversineDistanceKm(
      Number(viewerProfile.locationLat.toString()),
      Number(viewerProfile.locationLng.toString()),
      Number(otherProfile.locationLat.toString()),
      Number(otherProfile.locationLng.toString()),
    ),
  );

  return {
    city: otherProfile.city ?? null,
    region: otherProfile.region ?? null,
    countryCode: otherProfile.countryCode ?? null,
    distanceKmRounded: distanceKm,
    distanceBand: resolveDistanceBand(distanceKm),
  };
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDifference = today.getUTCMonth() - dateOfBirth.getUTCMonth();
  const dayDifference = today.getUTCDate() - dateOfBirth.getUTCDate();

  if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
    age -= 1;
  }

  return age;
}

```

FILE: src/modules/matches/controllers/matches.controller.ts
```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CursorPageQueryDto } from "../../../common/dto/cursor-page-query.dto";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  EndMatchService,
  GetMatchService,
  ListMatchesService,
  UpdateMatchCommunicationSettingService,
} from "../application/matches.services";
import type {
  EndMatchResponseDto,
  MatchDetailResponseDto,
  MatchPageDto,
  UpdateMyMatchCommunicationSettingResponseDto,
} from "../dto/matches.dto";
import { UpdateMyMatchCommunicationSettingDto } from "../dto/matches.dto";

@Controller("matches")
export class MatchesController {
  constructor(
    private readonly listMatchesService: ListMatchesService,
    private readonly getMatchService: GetMatchService,
    private readonly endMatchService: EndMatchService,
    private readonly updateMatchCommunicationSettingService: UpdateMatchCommunicationSettingService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthContext["user"],
    @Query() query: CursorPageQueryDto,
  ): Promise<MatchPageDto> {
    return this.listMatchesService.execute({
      userId: user.id,
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 50) : 20,
    });
  }

  @Get(":matchId")
  async getById(
    @CurrentUser() user: AuthContext["user"],
    @Param("matchId", new ParseUUIDPipe()) matchId: string,
  ): Promise<MatchDetailResponseDto> {
    return this.getMatchService.execute({
      userId: user.id,
      matchId,
    });
  }

  @Delete(":matchId")
  async end(
    @CurrentUser() user: AuthContext["user"],
    @Param("matchId", new ParseUUIDPipe()) matchId: string,
    @Req() request: Request,
  ): Promise<EndMatchResponseDto> {
    return this.endMatchService.execute({
      userId: user.id,
      matchId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Put(":matchId/communication-settings/me")
  async updateMyCommunicationSetting(
    @CurrentUser() user: AuthContext["user"],
    @Param("matchId", new ParseUUIDPipe()) matchId: string,
    @Body() body: UpdateMyMatchCommunicationSettingDto,
    @Req() request: Request,
  ): Promise<UpdateMyMatchCommunicationSettingResponseDto> {
    return this.updateMatchCommunicationSettingService.execute({
      userId: user.id,
      matchId,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}

```

FILE: src/modules/matches/matches.module.ts
```ts
import { Module } from "@nestjs/common";
import { AuditLogService } from "../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { DiscoveryModule } from "../discovery/discovery.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { MatchesController } from "./controllers/matches.controller";
import {
  CreateMatchArtifactsService,
  EndMatchService,
  GetMatchService,
  ListMatchesService,
  MatchReaderService,
  UpdateMatchCommunicationSettingService,
} from "./application/matches.services";
import {
  MatchCommunicationPolicyService,
  MatchParticipantPolicy,
  MatchPolicyService,
} from "./domain/matches.domain";
import {
  MatchCommunicationSettingRepository,
  MatchRepository,
} from "./infrastructure/matches.infrastructure";

@Module({
  imports: [DiscoveryModule, ConversationsModule],
  controllers: [MatchesController],
  providers: [
    AuditLogService,
    DomainEventPublisher,
    MatchReaderService,
    CreateMatchArtifactsService,
    ListMatchesService,
    GetMatchService,
    EndMatchService,
    UpdateMatchCommunicationSettingService,
    MatchPolicyService,
    MatchCommunicationPolicyService,
    MatchParticipantPolicy,
    MatchRepository,
    MatchCommunicationSettingRepository,
  ],
  exports: [
    MatchReaderService,
    CreateMatchArtifactsService,
    MatchPolicyService,
    MatchCommunicationPolicyService,
  ],
})
export class MatchesModule {}

```

FILE: src/modules/likes/dto/likes.dto.ts
```ts
import { IsNotEmpty, IsUUID } from "class-validator";
import type { ConversationSummaryDto } from "../../conversations/dto/conversations.dto";
import type { MatchSummaryDto } from "../../matches/dto/matches.dto";

export class CreateLikeDto {
  @IsUUID("4")
  @IsNotEmpty()
  readonly targetUserId!: string;
}

export interface LikeDto {
  id: string;
  actorId: string;
  targetId: string;
  status: "ACTIVE" | "MATCHED" | "RETRACTED";
  matchedAt: string | null;
  retractedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLikeResponseDto {
  outcome: "LIKE_RECORDED" | "MATCH_CREATED";
  like: LikeDto;
  match: MatchSummaryDto | null;
  conversation: ConversationSummaryDto | null;
}

export class CreatePassDto {
  @IsUUID("4")
  @IsNotEmpty()
  readonly targetUserId!: string;
}

export interface PassDto {
  id: string;
  actorId: string;
  targetId: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

```

FILE: src/modules/likes/domain/likes.domain.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { Like, User, UserProfile } from "../../../generated/prisma/client";

type LikeTargetRecord = Pick<
  User,
  "id" | "status" | "deletedAt" | "isShadowBanned" | "isDiscoveryFrozen"
> & {
  profile: Pick<UserProfile, "isHidden" | "isComplete" | "deletedAt"> | null;
  photos: Array<{
    id: string;
  }>;
};

@Injectable()
export class LikePolicyService {
  assertCanLike(actorId: string, targetUserId: string): void {
    if (actorId === targetUserId) {
      throw new AppException(
        400,
        ERROR_CODES.LIKE_SELF_FORBIDDEN,
        "User cannot like themselves",
      );
    }
  }

  assertTargetEligible(target: LikeTargetRecord | null): asserts target is LikeTargetRecord {
    if (
      !target ||
      target.deletedAt !== null ||
      target.status !== "ACTIVE" ||
      target.isShadowBanned ||
      target.isDiscoveryFrozen ||
      !target.profile ||
      target.profile.deletedAt !== null ||
      target.profile.isHidden ||
      !target.profile.isComplete ||
      target.photos.length === 0
    ) {
      throw new AppException(
        409,
        ERROR_CODES.LIKE_TARGET_NOT_ELIGIBLE,
        "Target cannot currently be interacted with",
      );
    }
  }

  assertNotBlocked(isBlocked: boolean): void {
    if (isBlocked) {
      throw new AppException(
        409,
        ERROR_CODES.LIKE_BLOCKED,
        "Like blocked by active block",
      );
    }
  }

  assertCanRetract(like: Pick<Like, "status">): void {
    if (like.status === "RETRACTED") {
      throw new AppException(
        409,
        ERROR_CODES.LIKE_ALREADY_RETRACTED,
        "Like already retracted",
      );
    }
  }
}

@Injectable()
export class PassPolicyService {
  assertCanPass(actorId: string, targetUserId: string): void {
    if (actorId === targetUserId) {
      throw new AppException(
        400,
        ERROR_CODES.PASS_SELF_FORBIDDEN,
        "User cannot pass themselves",
      );
    }
  }
}

```

FILE: src/modules/likes/policies/likes.policies.ts
```ts
export { LikePolicyService, PassPolicyService } from "../domain/likes.domain";

```

FILE: src/modules/likes/events/likes.events.ts
```ts
export const LIKE_EVENTS = {
  CREATED: "like.created",
} as const;

```

FILE: src/modules/likes/infrastructure/likes.infrastructure.ts
```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import { RedisService } from "../../../integrations/redis/redis.service";
import type {
  Like,
  Pass,
  User,
  UserProfile,
} from "../../../generated/prisma/client";

type LikeExecutor = PrismaService | PrismaTransactionalClient;

export type LikeTargetRecord = Pick<
  User,
  "id" | "status" | "deletedAt" | "isShadowBanned" | "isDiscoveryFrozen"
> & {
  profile: Pick<UserProfile, "isHidden" | "isComplete" | "deletedAt"> | null;
  photos: Array<{
    id: string;
  }>;
};

@Injectable()
export class LikeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByActorAndTarget(
    actorId: string,
    targetId: string,
    executor?: LikeExecutor,
  ): Promise<Like | null> {
    const db = executor ?? this.prisma;

    return db.like.findUnique({
      where: {
        actorId_targetId: {
          actorId,
          targetId,
        },
      },
    });
  }

  async create(
    executor: PrismaTransactionalClient,
    input: {
      actorId: string;
      targetId: string;
    },
  ): Promise<Like> {
    return executor.like.create({
      data: {
        actorId: input.actorId,
        targetId: input.targetId,
      },
    });
  }

  async reactivate(
    executor: PrismaTransactionalClient,
    likeId: string,
  ): Promise<Like> {
    return executor.like.update({
      where: {
        id: likeId,
      },
      data: {
        status: "ACTIVE",
        retractedAt: null,
      },
    });
  }

  async markMatched(
    executor: PrismaTransactionalClient,
    likeId: string,
    matchedAt: Date,
  ): Promise<Like> {
    return executor.like.update({
      where: {
        id: likeId,
      },
      data: {
        status: "MATCHED",
        matchedAt,
        retractedAt: null,
      },
    });
  }

  async retract(
    executor: PrismaTransactionalClient,
    likeId: string,
    retractedAt: Date,
  ): Promise<Like> {
    return executor.like.update({
      where: {
        id: likeId,
      },
      data: {
        status: "RETRACTED",
        retractedAt,
      },
    });
  }
}

@Injectable()
export class PassRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByActorAndTarget(
    actorId: string,
    targetId: string,
    executor?: LikeExecutor,
  ): Promise<Pass | null> {
    const db = executor ?? this.prisma;

    return db.pass.findUnique({
      where: {
        actorId_targetId: {
          actorId,
          targetId,
        },
      },
    });
  }

  async upsertActive(
    executor: PrismaTransactionalClient,
    input: {
      actorId: string;
      targetId: string;
      expiresAt: Date;
    },
  ): Promise<Pass> {
    return executor.pass.upsert({
      where: {
        actorId_targetId: {
          actorId: input.actorId,
          targetId: input.targetId,
        },
      },
      create: {
        actorId: input.actorId,
        targetId: input.targetId,
        expiresAt: input.expiresAt,
      },
      update: {
        expiresAt: input.expiresAt,
        deletedAt: null,
      },
    });
  }

  async softDelete(
    executor: PrismaTransactionalClient,
    passId: string,
    deletedAt: Date,
  ): Promise<Pass> {
    return executor.pass.update({
      where: {
        id: passId,
      },
      data: {
        deletedAt,
      },
    });
  }
}

@Injectable()
export class LikeInteractionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLikeTarget(targetUserId: string): Promise<LikeTargetRecord | null> {
    return this.prisma.user.findFirst({
      where: {
        id: targetUserId,
      },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        isShadowBanned: true,
        isDiscoveryFrozen: true,
        profile: {
          select: {
            isHidden: true,
            isComplete: true,
            deletedAt: true,
          },
        },
        photos: {
          where: {
            deletedAt: null,
            moderationStatus: "APPROVED",
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });
  }

  async hasActiveBlockBetween(
    actorId: string,
    targetId: string,
    executor?: LikeExecutor,
  ): Promise<boolean> {
    const db = executor ?? this.prisma;
    const count = await db.block.count({
      where: {
        deletedAt: null,
        OR: [
          {
            blockerId: actorId,
            blockedId: targetId,
          },
          {
            blockerId: targetId,
            blockedId: actorId,
          },
        ],
      },
    });

    return count > 0;
  }

  async hasHistoricalMatchBetween(
    actorId: string,
    targetId: string,
    executor?: LikeExecutor,
  ): Promise<boolean> {
    const [userLowId, userHighId] =
      actorId < targetId ? [actorId, targetId] : [targetId, actorId];
    const db = executor ?? this.prisma;

    const match = await db.match.findUnique({
      where: {
        userLowId_userHighId: {
          userLowId,
          userHighId,
        },
      },
      select: {
        id: true,
      },
    });

    return !!match;
  }
}

@Injectable()
export class LikeIdempotencyRepository {
  private static readonly TTL_SECONDS = 24 * 60 * 60;

  constructor(private readonly redis: RedisService) {}

  async get<TValue>(userId: string, key: string): Promise<TValue | null> {
    const raw = await this.redis.get(this.buildKey(userId, key));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as TValue;
  }

  async set<TValue>(userId: string, key: string, value: TValue): Promise<void> {
    await this.redis.set(
      this.buildKey(userId, key),
      JSON.stringify(value),
      "EX",
      LikeIdempotencyRepository.TTL_SECONDS,
    );
  }

  private buildKey(userId: string, key: string): string {
    return `idem:${userId}:like:${key}`;
  }
}

```

FILE: src/modules/likes/application/likes.services.ts
```ts
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { BullmqProducer } from "../../../integrations/bullmq/bullmq.producer";
import { UserReaderService } from "../../users/application/users.services";
import { InvalidateDiscoverySnapshotService } from "../../discovery/application/discovery.services";
import {
  ConversationReaderService,
} from "../../conversations/application/conversations.services";
import { MATCH_EVENTS } from "../../matches/events/matches.events";
import {
  CreateMatchArtifactsService,
  MatchReaderService,
} from "../../matches/application/matches.services";
import type {
  CreateLikeDto,
  CreateLikeResponseDto,
  LikeDto,
  PassDto,
} from "../dto/likes.dto";
import { LikePolicyService, PassPolicyService } from "../domain/likes.domain";
import { LIKE_EVENTS } from "../events/likes.events";
import {
  LikeIdempotencyRepository,
  LikeInteractionRepository,
  LikeRepository,
  PassRepository,
} from "../infrastructure/likes.infrastructure";

const PASS_TTL_DAYS = 14;
const SERIALIZABLE_RETRY_ATTEMPTS = 3;

export interface LikeActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class LikeReaderService {
  mapLike(like: {
    id: string;
    actorId: string;
    targetId: string;
    status: "ACTIVE" | "MATCHED" | "RETRACTED";
    matchedAt: Date | null;
    retractedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): LikeDto {
    return {
      id: like.id,
      actorId: like.actorId,
      targetId: like.targetId,
      status: like.status,
      matchedAt: like.matchedAt?.toISOString() ?? null,
      retractedAt: like.retractedAt?.toISOString() ?? null,
      createdAt: like.createdAt.toISOString(),
      updatedAt: like.updatedAt.toISOString(),
    };
  }
}

@Injectable()
export class CreateLikeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly likePolicyService: LikePolicyService,
    private readonly likeRepository: LikeRepository,
    private readonly likeInteractionRepository: LikeInteractionRepository,
    private readonly createMatchArtifactsService: CreateMatchArtifactsService,
    private readonly matchReaderService: MatchReaderService,
    private readonly conversationReaderService: ConversationReaderService,
    private readonly likeReaderService: LikeReaderService,
    private readonly discoveryInvalidationService: InvalidateDiscoverySnapshotService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly bullmqProducer: BullmqProducer,
    private readonly likeIdempotencyRepository: LikeIdempotencyRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: CreateLikeDto;
    metadata: LikeActionMetadata;
    idempotencyKey?: string;
  }): Promise<CreateLikeResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.likePolicyService.assertCanLike(input.userId, input.payload.targetUserId);

    if (input.idempotencyKey) {
      const cached = await this.likeIdempotencyRepository.get<CreateLikeResponseDto>(
        input.userId,
        input.idempotencyKey,
      );
      if (cached) {
        return cached;
      }
    }

    const target = await this.likeInteractionRepository.findLikeTarget(
      input.payload.targetUserId,
    );
    this.likePolicyService.assertTargetEligible(target);

    const hasHistoricalMatch =
      await this.likeInteractionRepository.hasHistoricalMatchBetween(
        input.userId,
        input.payload.targetUserId,
      );
    if (hasHistoricalMatch) {
      throw new AppException(
        409,
        ERROR_CODES.LIKE_TARGET_NOT_ELIGIBLE,
        "Target cannot currently be interacted with",
      );
    }

    const blocked = await this.likeInteractionRepository.hasActiveBlockBetween(
      input.userId,
      input.payload.targetUserId,
    );
    this.likePolicyService.assertNotBlocked(blocked);

    const existingLike = await this.likeRepository.findByActorAndTarget(
      input.userId,
      input.payload.targetUserId,
    );
    if (existingLike?.status === "MATCHED") {
      const response = await this.buildMatchedResponse(
        existingLike,
        input.userId,
        input.payload.targetUserId,
      );
      await this.persistIdempotentResponse(
        input.userId,
        input.idempotencyKey,
        response,
      );
      return response;
    }
    if (existingLike?.status === "ACTIVE") {
      const response: CreateLikeResponseDto = {
        outcome: "LIKE_RECORDED",
        like: this.likeReaderService.mapLike(existingLike),
        match: null,
        conversation: null,
      };
      await this.persistIdempotentResponse(
        input.userId,
        input.idempotencyKey,
        response,
      );
      return response;
    }

    const now = new Date();
    const transactionResult = await withSerializableRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const txBlocked =
            await this.likeInteractionRepository.hasActiveBlockBetween(
              input.userId,
              input.payload.targetUserId,
              tx,
            );
          this.likePolicyService.assertNotBlocked(txBlocked);

          const targetInsideTx = await tx.user.findFirst({
            where: {
              id: input.payload.targetUserId,
            },
            select: {
              id: true,
              status: true,
              deletedAt: true,
              isShadowBanned: true,
              isDiscoveryFrozen: true,
              profile: {
                select: {
                  isHidden: true,
                  isComplete: true,
                  deletedAt: true,
                },
              },
              photos: {
                where: {
                  deletedAt: null,
                  moderationStatus: "APPROVED",
                },
                select: {
                  id: true,
                },
                take: 1,
              },
            },
          });
          this.likePolicyService.assertTargetEligible(targetInsideTx);

          const historicalMatch =
            await this.likeInteractionRepository.hasHistoricalMatchBetween(
              input.userId,
              input.payload.targetUserId,
              tx,
            );
          if (historicalMatch) {
            throw new AppException(
              409,
              ERROR_CODES.LIKE_TARGET_NOT_ELIGIBLE,
              "Target cannot currently be interacted with",
            );
          }

          const currentLike = await this.likeRepository.findByActorAndTarget(
            input.userId,
            input.payload.targetUserId,
            tx,
          );

          let actorLike = currentLike;
          if (!currentLike) {
            actorLike = await this.likeRepository.create(tx, {
              actorId: input.userId,
              targetId: input.payload.targetUserId,
            });
          } else if (currentLike.status === "RETRACTED") {
            actorLike = await this.likeRepository.reactivate(tx, currentLike.id);
          } else if (currentLike.status === "MATCHED") {
            return {
              kind: "existing-match" as const,
              like: currentLike,
            };
          }

          if (!actorLike) {
            throw new AppException(
              500,
              ERROR_CODES.INTERNAL_ERROR,
              "Like transaction failed to materialize actor like",
            );
          }

          const reciprocalLike = await this.likeRepository.findByActorAndTarget(
            input.payload.targetUserId,
            input.userId,
            tx,
          );

          if (
            reciprocalLike &&
            (reciprocalLike.status === "ACTIVE" ||
              reciprocalLike.status === "MATCHED")
          ) {
            const artifacts = await this.createMatchArtifactsService.execute(tx, {
              actorId: input.userId,
              targetId: input.payload.targetUserId,
              matchedAt: now,
            });

            const matchedActorLike =
              actorLike.status === "MATCHED"
                ? actorLike
                : await this.likeRepository.markMatched(tx, actorLike.id, now);

            if (reciprocalLike.status === "ACTIVE") {
              await this.likeRepository.markMatched(tx, reciprocalLike.id, now);
            }

            await this.auditLogService.write(
              {
                actorUserId: input.userId,
                action: "like.match-created",
                entityType: "Match",
                entityId: artifacts.match.id,
                targetUserId: input.payload.targetUserId,
                ipAddress: input.metadata.ipAddress,
                userAgent: input.metadata.userAgent,
                metadata: {
                  likeId: matchedActorLike.id,
                  conversationId: artifacts.conversationId,
                },
              },
              tx,
            );

            return {
              kind: "match-created" as const,
              like: matchedActorLike,
              matchId: artifacts.match.id,
              conversationId: artifacts.conversationId,
            };
          }

          await this.auditLogService.write(
            {
              actorUserId: input.userId,
              action: "like.create",
              entityType: "Like",
              entityId: actorLike.id,
              targetUserId: input.payload.targetUserId,
              ipAddress: input.metadata.ipAddress,
              userAgent: input.metadata.userAgent,
            },
            tx,
          );

          return {
            kind: "like-recorded" as const,
            like: actorLike,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );

    await this.discoveryInvalidationService.execute(input.userId);

    let response: CreateLikeResponseDto;
    if (transactionResult.kind === "match-created") {
      response = await this.buildMatchedResponse(
        transactionResult.like,
        input.userId,
        input.payload.targetUserId,
        transactionResult.matchId,
        transactionResult.conversationId,
      );

      await this.discoveryInvalidationService.execute(input.payload.targetUserId);
      await this.domainEventPublisher.publish(MATCH_EVENTS.CREATED, {
        matchId: transactionResult.matchId,
        conversationId: transactionResult.conversationId,
        userIds: [input.userId, input.payload.targetUserId],
      });
      await this.bullmqProducer.enqueue(
        "notification.dispatch",
        {
          type: "NEW_MATCH",
          recipientUserId: input.payload.targetUserId,
          actorUserId: input.userId,
          matchId: transactionResult.matchId,
          conversationId: transactionResult.conversationId,
        },
        {
          jobId: `notification:new-match:${transactionResult.matchId}:${input.payload.targetUserId}`,
        },
      );
    } else if (transactionResult.kind === "existing-match") {
      response = await this.buildMatchedResponse(
        transactionResult.like,
        input.userId,
        input.payload.targetUserId,
      );
    } else {
      response = {
        outcome: "LIKE_RECORDED",
        like: this.likeReaderService.mapLike(transactionResult.like),
        match: null,
        conversation: null,
      };
      await this.domainEventPublisher.publish(LIKE_EVENTS.CREATED, {
        likeId: transactionResult.like.id,
        actorId: transactionResult.like.actorId,
        targetId: transactionResult.like.targetId,
      });
    }

    await this.persistIdempotentResponse(
      input.userId,
      input.idempotencyKey,
      response,
    );

    return response;
  }

  private async buildMatchedResponse(
    like: {
      id: string;
      actorId: string;
      targetId: string;
      status: "ACTIVE" | "MATCHED" | "RETRACTED";
      matchedAt: Date | null;
      retractedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    viewerUserId: string,
    targetUserId: string,
    providedMatchId?: string,
    providedConversationId?: string,
  ): Promise<CreateLikeResponseDto> {
    const match =
      providedMatchId ??
      (await this.resolveMatchId(viewerUserId, targetUserId));
    if (!match) {
      return {
        outcome: "LIKE_RECORDED",
        like: this.likeReaderService.mapLike(like),
        match: null,
        conversation: null,
      };
    }

    const matchProjection = await this.matchReaderService.getRequiredMatch(
      match,
      viewerUserId,
    );
    const conversationId =
      providedConversationId ?? matchProjection.conversation?.id ?? null;
    const conversation =
      conversationId !== null
        ? await this.conversationReaderService.getRequiredConversation(
            conversationId,
            viewerUserId,
          )
        : null;

    return {
      outcome: "MATCH_CREATED",
      like: this.likeReaderService.mapLike(like),
      match: this.matchReaderService.mapSummary(matchProjection, viewerUserId),
      conversation:
        conversation && conversationId
          ? this.conversationReaderService.mapConversationSummary(
              conversation,
              viewerUserId,
            )
          : null,
    };
  }

  private async resolveMatchId(
    actorId: string,
    targetId: string,
  ): Promise<string | null> {
    const [userLowId, userHighId] =
      actorId < targetId ? [actorId, targetId] : [targetId, actorId];
    const match = await this.prisma.match.findUnique({
      where: {
        userLowId_userHighId: {
          userLowId,
          userHighId,
        },
      },
      select: {
        id: true,
      },
    });

    return match?.id ?? null;
  }

  private async persistIdempotentResponse(
    userId: string,
    idempotencyKey: string | undefined,
    response: CreateLikeResponseDto,
  ): Promise<void> {
    if (!idempotencyKey) {
      return;
    }

    await this.likeIdempotencyRepository.set(userId, idempotencyKey, response);
  }
}

@Injectable()
export class RetractLikeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly likePolicyService: LikePolicyService,
    private readonly likeRepository: LikeRepository,
    private readonly discoveryInvalidationService: InvalidateDiscoverySnapshotService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    targetUserId: string;
    metadata: LikeActionMetadata;
  }): Promise<void> {
    await this.userReaderService.getRequiredById(input.userId);
    this.likePolicyService.assertCanLike(input.userId, input.targetUserId);

    const like = await this.likeRepository.findByActorAndTarget(
      input.userId,
      input.targetUserId,
    );

    if (!like || like.status === "MATCHED") {
      return;
    }

    this.likePolicyService.assertCanRetract(like);

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.likeRepository.retract(tx, like.id, now);
      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "like.retract",
          entityType: "Like",
          entityId: like.id,
          targetUserId: input.targetUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );
    });

    await this.discoveryInvalidationService.execute(input.userId);
  }
}

@Injectable()
export class CreatePassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly passPolicyService: PassPolicyService,
    private readonly likeInteractionRepository: LikeInteractionRepository,
    private readonly passRepository: PassRepository,
    private readonly discoveryInvalidationService: InvalidateDiscoverySnapshotService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    targetUserId: string;
    metadata: LikeActionMetadata;
  }): Promise<PassDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.passPolicyService.assertCanPass(input.userId, input.targetUserId);

    const target = await this.likeInteractionRepository.findLikeTarget(
      input.targetUserId,
    );
    if (!target || target.deletedAt !== null) {
      throw new AppException(
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "Target user not found",
      );
    }

    const expiresAt = addDays(new Date(), PASS_TTL_DAYS);
    const pass = await this.prisma.$transaction(async (tx) => {
      const row = await this.passRepository.upsertActive(tx, {
        actorId: input.userId,
        targetId: input.targetUserId,
        expiresAt,
      });

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "pass.create",
          entityType: "Pass",
          entityId: row.id,
          targetUserId: input.targetUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return row;
    });

    await this.discoveryInvalidationService.execute(input.userId);

    return mapPassDto(pass);
  }
}

@Injectable()
export class RetractPassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly passPolicyService: PassPolicyService,
    private readonly passRepository: PassRepository,
    private readonly discoveryInvalidationService: InvalidateDiscoverySnapshotService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    targetUserId: string;
    metadata: LikeActionMetadata;
  }): Promise<void> {
    await this.userReaderService.getRequiredById(input.userId);
    this.passPolicyService.assertCanPass(input.userId, input.targetUserId);

    const pass = await this.passRepository.findByActorAndTarget(
      input.userId,
      input.targetUserId,
    );
    if (!pass || pass.deletedAt) {
      return;
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.passRepository.softDelete(tx, pass.id, now);
      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "pass.retract",
          entityType: "Pass",
          entityId: pass.id,
          targetUserId: input.targetUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );
    });

    await this.discoveryInvalidationService.execute(input.userId);
  }
}

async function withSerializableRetry<TValue>(
  callback: () => Promise<TValue>,
): Promise<TValue> {
  let attempt = 0;

  while (attempt < SERIALIZABLE_RETRY_ATTEMPTS) {
    try {
      return await callback();
    } catch (error) {
      attempt += 1;
      if (!isSerializableConflict(error) || attempt >= SERIALIZABLE_RETRY_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new AppException(500, ERROR_CODES.INTERNAL_ERROR, "Unexpected retry failure");
}

function isSerializableConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function mapPassDto(pass: {
  id: string;
  actorId: string;
  targetId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): PassDto {
  return {
    id: pass.id,
    actorId: pass.actorId,
    targetId: pass.targetId,
    expiresAt: pass.expiresAt.toISOString(),
    createdAt: pass.createdAt.toISOString(),
    updatedAt: pass.updatedAt.toISOString(),
  };
}

```

FILE: src/modules/likes/controllers/likes.controller.ts
```ts
import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  CreateLikeService,
  CreatePassService,
  RetractLikeService,
  RetractPassService,
} from "../application/likes.services";
import {
  CreateLikeDto,
  CreatePassDto,
  type CreateLikeResponseDto,
  type PassDto,
} from "../dto/likes.dto";

@Controller()
export class LikesController {
  constructor(
    private readonly createLikeService: CreateLikeService,
    private readonly retractLikeService: RetractLikeService,
    private readonly createPassService: CreatePassService,
    private readonly retractPassService: RetractPassService,
  ) {}

  @Post("likes")
  async createLike(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: CreateLikeDto,
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey?: string,
  ): Promise<CreateLikeResponseDto> {
    return this.createLikeService.execute({
      userId: user.id,
      payload: body,
      idempotencyKey,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Delete("likes/:targetUserId")
  @HttpCode(204)
  async retractLike(
    @CurrentUser() user: AuthContext["user"],
    @Param("targetUserId", new ParseUUIDPipe()) targetUserId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.retractLikeService.execute({
      userId: user.id,
      targetUserId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Post("passes")
  async createPass(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: CreatePassDto,
    @Req() request: Request,
  ): Promise<PassDto> {
    return this.createPassService.execute({
      userId: user.id,
      targetUserId: body.targetUserId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Delete("passes/:targetUserId")
  @HttpCode(204)
  async retractPass(
    @CurrentUser() user: AuthContext["user"],
    @Param("targetUserId", new ParseUUIDPipe()) targetUserId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.retractPassService.execute({
      userId: user.id,
      targetUserId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}

```

FILE: src/modules/likes/likes.module.ts
```ts
import { Module } from "@nestjs/common";
import { AuditLogService } from "../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { DiscoveryModule } from "../discovery/discovery.module";
import { MatchesModule } from "../matches/matches.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { UsersModule } from "../users/users.module";
import { LikesController } from "./controllers/likes.controller";
import {
  CreateLikeService,
  CreatePassService,
  LikeReaderService,
  RetractLikeService,
  RetractPassService,
} from "./application/likes.services";
import { LikePolicyService, PassPolicyService } from "./domain/likes.domain";
import {
  LikeIdempotencyRepository,
  LikeInteractionRepository,
  LikeRepository,
  PassRepository,
} from "./infrastructure/likes.infrastructure";

@Module({
  imports: [UsersModule, DiscoveryModule, MatchesModule, ConversationsModule],
  controllers: [LikesController],
  providers: [
    AuditLogService,
    DomainEventPublisher,
    LikeReaderService,
    CreateLikeService,
    RetractLikeService,
    CreatePassService,
    RetractPassService,
    LikePolicyService,
    PassPolicyService,
    LikeRepository,
    PassRepository,
    LikeInteractionRepository,
    LikeIdempotencyRepository,
  ],
  exports: [LikeReaderService],
})
export class LikesModule {}

```

FILE: src/modules/discovery/domain/discovery.domain.spec.ts
```ts
import {
  CandidateEligibilityService,
  DiscoveryRankingService,
} from "./discovery.domain";

describe("Discovery domain services", () => {
  it("rejects excluded candidates before scoring", () => {
    const service = new CandidateEligibilityService();

    const result = service.isEligible(
      {
        id: "viewer-1",
        discoveryPreference: {
          minAge: 24,
          maxAge: 40,
          maxDistanceKm: 50,
        },
        profile: {
          dateOfBirth: new Date("1992-01-01T00:00:00.000Z"),
          locationLat: { toString: () => "12.9716" },
          locationLng: { toString: () => "77.5946" },
        },
      } as any,
      {
        id: "candidate-1",
        profile: {
          dateOfBirth: new Date("1994-01-01T00:00:00.000Z"),
          locationLat: { toString: () => "12.9800" },
          locationLng: { toString: () => "77.6000" },
          gender: "WOMAN",
        },
        intents: [{ intent: "FRIENDSHIP" }],
      } as any,
      {
        maxDistanceKm: 50,
        selectedIntents: ["FRIENDSHIP"],
        preferredGenders: [],
        excludedUserIds: new Set(["candidate-1"]),
      },
    );

    expect(result.eligible).toBe(false);
  });

  it("scores the same candidate deterministically", () => {
    const service = new DiscoveryRankingService();
    const viewer = {
      interests: [{ interestTagId: "tag-1" }],
      intents: [{ intent: "FRIENDSHIP" }],
      lifestyle: {
        smoking: "NEVER",
        drinking: "SOCIAL",
        exercise: "WEEKLY",
        diet: "OMNIVORE",
        petPreference: "LIKES_PETS",
        sleepPattern: "FLEXIBLE",
        socialEnergy: "BALANCED",
      },
      schedulePreference: {
        weekdayMask: 62,
        timeBlockMask: 240,
        prefersWeekends: true,
        remoteFriendly: false,
      },
      discoveryPreference: {
        intentFilter: ["FRIENDSHIP"],
        maxDistanceKm: 50,
      },
    };
    const candidate = {
      id: "candidate-1",
      interests: [{ interestTagId: "tag-1" }],
      intents: [{ intent: "FRIENDSHIP" }],
      lifestyle: {
        smoking: "NEVER",
        drinking: "SOCIAL",
        exercise: "WEEKLY",
        diet: "OMNIVORE",
        petPreference: "LIKES_PETS",
        sleepPattern: "FLEXIBLE",
        socialEnergy: "BALANCED",
      },
      schedulePreference: {
        weekdayMask: 62,
        timeBlockMask: 240,
        prefersWeekends: true,
        remoteFriendly: false,
      },
      trustScore: {
        score: 82,
      },
      lastActiveAt: new Date("2026-04-17T08:00:00.000Z"),
      profile: {
        city: "Bengaluru",
        region: "Karnataka",
        countryCode: "IN",
      },
    };

    const first = service.scoreCandidate(viewer as any, candidate as any, {
      distanceKm: 8,
      primaryIntentBucket: "FRIENDSHIP",
      recentlyServed: false,
    });
    const second = service.scoreCandidate(viewer as any, candidate as any, {
      distanceKm: 8,
      primaryIntentBucket: "FRIENDSHIP",
      recentlyServed: false,
    });

    expect(first.totalScore).toBe(second.totalScore);
    expect(first.distanceKm).toBe(second.distanceKm);
    expect(first.cityBucket).toBe(second.cityBucket);
  });
});

```

FILE: src/modules/conversations/application/conversations.services.spec.ts
```ts
import { MarkConversationReadService } from "./conversations.services";
import { ConversationAccessPolicyService } from "../domain/conversations.domain";
import { CONVERSATION_EVENTS } from "../events/conversations.events";

describe("Conversations services", () => {
  it("marks a conversation read and publishes the finalized payload shape", async () => {
    const tx = {};
    const service = new MarkConversationReadService(
      {
        $transaction: jest.fn(async (callback: (client: object) => Promise<unknown>) =>
          callback(tx),
        ),
      } as any,
      {
        findByIdForUser: jest.fn().mockResolvedValue({
          id: "conversation-1",
          status: "ACTIVE",
          lastMessageSequence: 8,
          match: {
            status: "ACTIVE",
            userLowId: "user-1",
            userHighId: "user-2",
          },
          reads: [
            {
              lastReadSequence: 2,
            },
          ],
        }),
      } as any,
      {
        updateReadState: jest.fn().mockResolvedValue({
          conversationId: "conversation-1",
          userId: "user-1",
          lastReadMessageId: "message-8",
          lastReadSequence: 8,
          lastReadAt: new Date("2026-04-17T10:00:00.000Z"),
        }),
      } as any,
      {
        findByConversationAndSequence: jest.fn().mockResolvedValue({
          id: "message-8",
          sequence: 8,
        }),
      } as any,
      new ConversationAccessPolicyService(),
      {
        publish: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    const result = await service.execute({
      userId: "user-1",
      conversationId: "conversation-1",
      lastReadSequence: 8,
    });

    expect(result.readState.lastReadSequence).toBe(8);
    expect((service as any).domainEventPublisher.publish).toHaveBeenCalledWith(
      CONVERSATION_EVENTS.READ_UPDATED,
      expect.objectContaining({
        conversationId: "conversation-1",
        readState: expect.objectContaining({
          userId: "user-1",
          lastReadSequence: 8,
        }),
      }),
    );
  });

  it("rejects read updates for closed conversations", () => {
    const policy = new ConversationAccessPolicyService();

    try {
      policy.assertCanUpdateReadState(
        {
          status: "BLOCKED",
          lastMessageSequence: 8,
        },
        {
          status: "ENDED",
        },
        {
          currentLastReadSequence: 2,
          requestedLastReadSequence: 4,
        },
      );
      throw new Error("Expected conversation policy to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "CONVERSATION_CLOSED",
      });
    }
  });
});

```

FILE: src/modules/matches/application/matches.services.spec.ts
```ts
import {
  EndMatchService,
  UpdateMatchCommunicationSettingService,
} from "./matches.services";
import {
  MatchCommunicationPolicyService,
  MatchParticipantPolicy,
  MatchPolicyService,
} from "../domain/matches.domain";
import { MATCH_EVENTS } from "../events/matches.events";

describe("Matches services", () => {
  it("updates my per-match communication settings", async () => {
    const tx = {};
    const prisma = {
      $transaction: jest.fn(async (callback: (client: object) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new UpdateMatchCommunicationSettingService(
      prisma as any,
      {
        findByIdForUser: jest.fn().mockResolvedValue({
          id: "match-1",
          status: "ACTIVE",
          userLowId: "user-1",
          userHighId: "user-2",
        }),
      } as any,
      new MatchPolicyService(),
      new MatchCommunicationPolicyService(),
      {
        updateForUser: jest.fn().mockResolvedValue({
          id: "setting-1",
          matchId: "match-1",
          userId: "user-1",
          allowVoiceCalls: true,
          allowVideoCalls: false,
          muted: true,
          updatedAt: new Date("2026-04-17T10:00:00.000Z"),
        }),
      } as any,
      {
        publish: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    const result = await service.execute({
      userId: "user-1",
      matchId: "match-1",
      payload: {
        allowVoiceCalls: true,
        allowVideoCalls: false,
        muted: true,
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(result.setting.allowVideoCalls).toBe(false);
    expect(result.setting.muted).toBe(true);
  });

  it("ends an active match and closes the conversation", async () => {
    const tx = {};
    const matchRecord = {
      id: "match-1",
      status: "ACTIVE",
      userLowId: "user-1",
      userHighId: "user-2",
      conversation: {
        id: "conversation-1",
      },
    };
    const service = new EndMatchService(
      {
        $transaction: jest.fn(async (callback: (client: object) => Promise<unknown>) =>
          callback(tx),
        ),
      } as any,
      {
        findByIdForUser: jest
          .fn()
          .mockResolvedValueOnce(matchRecord)
          .mockResolvedValueOnce({
            ...matchRecord,
            status: "ENDED",
            endedAt: new Date("2026-04-17T10:00:00.000Z"),
            endedReason: "UNMATCHED",
            matchedAt: new Date("2026-04-17T09:00:00.000Z"),
            updatedAt: new Date("2026-04-17T10:00:00.000Z"),
            conversation: {
              id: "conversation-1",
              lastMessagePreview: null,
              lastMessageSentAt: null,
            },
            communicationSettings: [],
            userLow: {
              id: "user-1",
              profile: {
                displayName: "User One",
                headline: null,
                bio: null,
                dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
                gender: null,
                pronouns: null,
                city: "Bengaluru",
                region: "Karnataka",
                countryCode: "IN",
                hideDistance: false,
                locationLat: { toString: () => "12.9716" },
                locationLng: { toString: () => "77.5946" },
              },
              photos: [],
              lifestyle: null,
              interests: [],
              intents: [{ intent: "FRIENDSHIP" }],
            },
            userHigh: {
              id: "user-2",
              profile: {
                displayName: "User Two",
                headline: null,
                bio: null,
                dateOfBirth: new Date("1991-01-01T00:00:00.000Z"),
                gender: null,
                pronouns: null,
                city: "Bengaluru",
                region: "Karnataka",
                countryCode: "IN",
                hideDistance: false,
                locationLat: { toString: () => "12.9800" },
                locationLng: { toString: () => "77.6000" },
              },
              photos: [],
              lifestyle: null,
              interests: [],
              intents: [{ intent: "FRIENDSHIP" }],
            },
          }),
        end: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        getRequiredMatch: jest.fn().mockResolvedValue({
          ...matchRecord,
          status: "ENDED",
          endedAt: new Date("2026-04-17T10:00:00.000Z"),
          endedReason: "UNMATCHED",
          matchedAt: new Date("2026-04-17T09:00:00.000Z"),
          updatedAt: new Date("2026-04-17T10:00:00.000Z"),
          conversation: {
            id: "conversation-1",
            lastMessagePreview: null,
            lastMessageSentAt: null,
          },
          communicationSettings: [],
          userLow: {
            id: "user-1",
            profile: {
              displayName: "User One",
              headline: null,
              bio: null,
              dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
              gender: null,
              pronouns: null,
              city: "Bengaluru",
              region: "Karnataka",
              countryCode: "IN",
              hideDistance: false,
              locationLat: { toString: () => "12.9716" },
              locationLng: { toString: () => "77.5946" },
            },
            photos: [],
            lifestyle: null,
            interests: [],
            intents: [{ intent: "FRIENDSHIP" }],
          },
          userHigh: {
            id: "user-2",
            profile: {
              displayName: "User Two",
              headline: null,
              bio: null,
              dateOfBirth: new Date("1991-01-01T00:00:00.000Z"),
              gender: null,
              pronouns: null,
              city: "Bengaluru",
              region: "Karnataka",
              countryCode: "IN",
              hideDistance: false,
              locationLat: { toString: () => "12.9800" },
              locationLng: { toString: () => "77.6000" },
            },
            photos: [],
            lifestyle: null,
            interests: [],
            intents: [{ intent: "FRIENDSHIP" }],
          },
        }),
        mapSummary: jest.fn().mockReturnValue({
          id: "match-1",
          status: "ENDED",
        }),
      } as any,
      new MatchPolicyService(),
      new MatchParticipantPolicy(),
      {
        closeForMatch: jest.fn().mockResolvedValue({
          id: "conversation-1",
        }),
      } as any,
      {
        execute: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        publish: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    const result = await service.execute({
      userId: "user-1",
      matchId: "match-1",
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(result.match.status).toBe("ENDED");
  });
});

```

FILE: src/modules/likes/application/likes.services.spec.ts
```ts
import { CreateLikeService } from "./likes.services";
import { LikePolicyService } from "../domain/likes.domain";
import { MATCH_EVENTS } from "../../matches/events/matches.events";

describe("CreateLikeService", () => {
  it("creates a match transactionally when a reciprocal active like exists", async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "user-2",
          status: "ACTIVE",
          deletedAt: null,
          isShadowBanned: false,
          isDiscoveryFrozen: false,
          profile: {
            isHidden: false,
            isComplete: true,
            deletedAt: null,
          },
          photos: [{ id: "photo-1" }],
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
      match: {
        findUnique: jest.fn().mockResolvedValue({
          id: "match-1",
        }),
      },
    };
    const actorLike = {
      id: "like-1",
      actorId: "user-1",
      targetId: "user-2",
      status: "ACTIVE" as const,
      matchedAt: null,
      retractedAt: null,
      createdAt: new Date("2026-04-17T10:00:00.000Z"),
      updatedAt: new Date("2026-04-17T10:00:00.000Z"),
    };
    const matchedLike = {
      ...actorLike,
      status: "MATCHED" as const,
      matchedAt: new Date("2026-04-17T10:01:00.000Z"),
    };
    const reciprocalLike = {
      id: "like-2",
      actorId: "user-2",
      targetId: "user-1",
      status: "ACTIVE" as const,
      matchedAt: null,
      retractedAt: null,
      createdAt: new Date("2026-04-17T10:00:00.000Z"),
      updatedAt: new Date("2026-04-17T10:00:00.000Z"),
    };
    const likeRepository = {
      findByActorAndTarget: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(reciprocalLike),
      create: jest.fn().mockResolvedValue(actorLike),
      reactivate: jest.fn(),
      markMatched: jest
        .fn()
        .mockResolvedValueOnce(matchedLike)
        .mockResolvedValueOnce({
          ...reciprocalLike,
          status: "MATCHED" as const,
          matchedAt: new Date("2026-04-17T10:01:00.000Z"),
        }),
    };
    const matchReaderService = {
      getRequiredMatch: jest.fn().mockResolvedValue({
        id: "match-1",
      }),
      mapSummary: jest.fn().mockReturnValue({
        id: "match-1",
        status: "ACTIVE",
      }),
    };
    const conversationReaderService = {
      getRequiredConversation: jest.fn().mockResolvedValue({
        id: "conversation-1",
      }),
      mapConversationSummary: jest.fn().mockReturnValue({
        id: "conversation-1",
        matchId: "match-1",
        status: "ACTIVE",
      }),
    };
    const domainEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    const bullmqProducer = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CreateLikeService(
      prisma as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      new LikePolicyService(),
      likeRepository as any,
      {
        findLikeTarget: jest.fn().mockResolvedValue({
          id: "user-2",
          status: "ACTIVE",
          deletedAt: null,
          isShadowBanned: false,
          isDiscoveryFrozen: false,
          profile: {
            isHidden: false,
            isComplete: true,
            deletedAt: null,
          },
          photos: [{ id: "photo-1" }],
        }),
        hasHistoricalMatchBetween: jest.fn().mockResolvedValue(false),
        hasActiveBlockBetween: jest.fn().mockResolvedValue(false),
      } as any,
      {
        execute: jest.fn().mockResolvedValue({
          match: {
            id: "match-1",
          },
          conversationId: "conversation-1",
          created: true,
        }),
      } as any,
      matchReaderService as any,
      conversationReaderService as any,
      {
        mapLike: jest.fn().mockReturnValue({
          id: "like-1",
          actorId: "user-1",
          targetId: "user-2",
          status: "MATCHED",
        }),
      } as any,
      {
        execute: jest.fn().mockResolvedValue(undefined),
      } as any,
      domainEventPublisher as any,
      bullmqProducer as any,
      {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    const result = await service.execute({
      userId: "user-1",
      payload: {
        targetUserId: "user-2",
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(result.outcome).toBe("MATCH_CREATED");
    expect(likeRepository.create).toHaveBeenCalledWith(tx, {
      actorId: "user-1",
      targetId: "user-2",
    });
    expect(domainEventPublisher.publish).toHaveBeenCalledWith(
      MATCH_EVENTS.CREATED,
      expect.objectContaining({
        matchId: "match-1",
      }),
    );
  });

  it("returns the existing match idempotently when the like is already matched", async () => {
    const service = new CreateLikeService(
      {
        $transaction: jest.fn(),
        match: {
          findUnique: jest.fn().mockResolvedValue({
            id: "match-1",
          }),
        },
      } as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      new LikePolicyService(),
      {
        findByActorAndTarget: jest.fn().mockResolvedValue({
          id: "like-1",
          actorId: "user-1",
          targetId: "user-2",
          status: "MATCHED",
          matchedAt: new Date("2026-04-17T10:01:00.000Z"),
          retractedAt: null,
          createdAt: new Date("2026-04-17T10:00:00.000Z"),
          updatedAt: new Date("2026-04-17T10:01:00.000Z"),
        }),
      } as any,
      {
        findLikeTarget: jest.fn().mockResolvedValue({
          id: "user-2",
          status: "ACTIVE",
          deletedAt: null,
          isShadowBanned: false,
          isDiscoveryFrozen: false,
          profile: {
            isHidden: false,
            isComplete: true,
            deletedAt: null,
          },
          photos: [{ id: "photo-1" }],
        }),
        hasHistoricalMatchBetween: jest.fn().mockResolvedValue(false),
        hasActiveBlockBetween: jest.fn().mockResolvedValue(false),
      } as any,
      {
        execute: jest.fn(),
      } as any,
      {
        getRequiredMatch: jest.fn().mockResolvedValue({
          id: "match-1",
        }),
        mapSummary: jest.fn().mockReturnValue({
          id: "match-1",
          status: "ACTIVE",
        }),
      } as any,
      {
        getRequiredConversation: jest.fn().mockResolvedValue({
          id: "conversation-1",
        }),
        mapConversationSummary: jest.fn().mockReturnValue({
          id: "conversation-1",
          matchId: "match-1",
          status: "ACTIVE",
        }),
      } as any,
      {
        mapLike: jest.fn().mockReturnValue({
          id: "like-1",
          actorId: "user-1",
          targetId: "user-2",
          status: "MATCHED",
        }),
      } as any,
      {
        execute: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        publish: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        enqueue: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    const result = await service.execute({
      userId: "user-1",
      payload: {
        targetUserId: "user-2",
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(result.outcome).toBe("MATCH_CREATED");
  });
});

```

