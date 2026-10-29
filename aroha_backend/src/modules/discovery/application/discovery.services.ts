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
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
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
import { mapDatingProfileFields } from "./public-profile-fields";

export const DAILY_CURATED_PROFILE_LIMIT = 8;
const SNAPSHOT_TTL_SECONDS = 24 * 60 * 60;

export function clampCuratedProfileLimit(requested?: number): number {
  if (requested === undefined) return DAILY_CURATED_PROFILE_LIMIT;
  return Math.max(1, Math.min(requested, DAILY_CURATED_PROFILE_LIMIT));
}

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
    private readonly objectStorageService: ObjectStorageService,
    @Inject(authConfig.KEY)
    private readonly authConfiguration: ConfigType<typeof authConfig>,
  ) {}

  async execute(input: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<DiscoveryFeedResponseDto> {
    const limit = clampCuratedProfileLimit(input.limit);
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

    // Snapshots preserve ordering only. Re-read permissions and relationships before
    // issuing profile metadata or signed media, including on subsequent pages.
    const remainingIds = snapshot.candidateIds.slice(nextIndex);
    const [pageRecords, exclusionState] = await Promise.all([
      this.discoveryQueryRepository.findCandidatesByIds(remainingIds),
      this.discoveryQueryRepository.loadExclusionState(viewer.id, now),
    ]);
    const recordsById = new Map(pageRecords.map((record) => [record.id, record]));
    const eligibilityInput = {
      // Preserve the existing ordinary-discovery fallback radius; Scene discovery
      // has its own strict radius and never uses this snapshot.
      maxDistanceKm: Math.min(250, 2 * (viewer.discoveryPreference?.maxDistanceKm ?? 50)),
      selectedIntents: viewer.discoveryPreference?.intentFilter.length
        ? viewer.discoveryPreference.intentFilter
        : viewer.intents.map((intent) => intent.intent),
      preferredGenders: viewer.discoveryPreference?.preferredGenders ?? [],
      excludedUserIds: new Set([
        viewer.id, ...exclusionState.blockedUserIds, ...exclusionState.matchedUserIds,
        ...exclusionState.activePassUserIds, ...exclusionState.activeLikeUserIds,
      ]),
    };
    const eligibleIds = new Set(pageRecords.filter((candidate) =>
      this.candidateEligibilityService.isEligible(viewer, candidate, eligibilityInput).eligible,
    ).map((candidate) => candidate.id));
    const candidates: CandidateDiscoveryRecord[] = [];
    let newIndex = nextIndex;
    while (newIndex < snapshot.candidateIds.length && candidates.length < limit) {
      const id = snapshot.candidateIds[newIndex++]!;
      if (eligibleIds.has(id)) candidates.push(recordsById.get(id)!);
    }
    // Avoid an empty terminal page when all remaining cached IDs were revoked.
    if (!snapshot.candidateIds.slice(newIndex).some(id => eligibleIds.has(id))) {
      newIndex = snapshot.candidateIds.length;
    }
    const items = await Promise.all(
      candidates.map((candidate) =>
        mapPublicProfile(viewer, candidate, this.objectStorageService),
      ),
    );

    await this.discoverySnapshotRepository.markRecentlyServed(
      viewer.id,
      items.map((item) => item.userId),
    );

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
      dailyLimit: DAILY_CURATED_PROFILE_LIMIT,
      remainingToday: snapshot.candidateIds.slice(newIndex).filter(id => eligibleIds.has(id)).length,
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
          .map((candidate) => candidate.candidate.id)
          .slice(0, DAILY_CURATED_PROFILE_LIMIT);
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

async function mapPublicProfile(
  viewer: ViewerDiscoveryContext,
  candidate: CandidateDiscoveryRecord,
  objectStorageService: ObjectStorageService,
): Promise<PublicProfileDto> {
  const distance = resolveDistance(viewer, candidate);
  const photos = await Promise.all(
    candidate.photos.map(
      async (photo): Promise<PublicPhotoDto> => ({
        id: photo.id,
        url: await objectStorageService.createPresignedGetObject({
          disclosure: { viewerId: viewer.id, ownerId: candidate.id },
          bucket: photo.bucket,
          objectKey: photo.objectKey,
        }),
        width: photo.width ?? null,
        height: photo.height ?? null,
        isPrimary: photo.isPrimary,
        position: photo.position,
      }),
    ),
  );

  return {
    userId: candidate.id,
    displayName: candidate.profile.displayName ?? "Unknown",
    headline: candidate.profile.headline ?? null,
    bio: candidate.profile.bio ?? null,
    age: candidate.profile.hideAge
      ? null
      : candidate.profile.dateOfBirth
      ? calculateAge(candidate.profile.dateOfBirth)
      : 0,
    gender: candidate.profile.gender ?? null,
    pronouns: candidate.profile.pronouns ?? null,
    ...mapDatingProfileFields(
      candidate.profile,
      buildCompatibilitySummary(viewer, candidate, distance),
    ),
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
    photos,
  };
}

function buildCompatibilitySummary(
  viewer: ViewerDiscoveryContext,
  candidate: CandidateDiscoveryRecord,
  location: LocationSummaryDto,
): PublicProfileDto["compatibility"] {
  const viewerIntents = new Set(viewer.intents.map((entry) => entry.intent));
  const sharedIntentCount = candidate.intents.filter((entry) => viewerIntents.has(entry.intent)).length;
  const viewerInterests = new Set(viewer.interests.map((entry) => entry.interestTagId));
  const sharedInterests = candidate.interests
    .filter((entry) => viewerInterests.has(entry.interestTagId))
    .map((entry) => entry.interestTag.displayName);
  const scheduleOverlap = describePublicScheduleOverlap(viewer, candidate);
  const lifestylePairs = [
    [viewer.lifestyle?.smoking, candidate.lifestyle?.smoking],
    [viewer.lifestyle?.drinking, candidate.lifestyle?.drinking],
    [viewer.lifestyle?.exercise, candidate.lifestyle?.exercise],
    [viewer.lifestyle?.diet, candidate.lifestyle?.diet],
    [viewer.lifestyle?.sleepPattern, candidate.lifestyle?.sleepPattern],
  ];
  const matchingLifestyle = lifestylePairs.filter(
    ([left, right]) => left !== null && left !== undefined && left === right,
  ).length;
  const score = Math.min(
    96,
    Math.max(
      55,
      50 +
        Math.min(24, sharedIntentCount * 12) +
        Math.min(18, sharedInterests.length * 6) +
        (scheduleOverlap ? 8 : 0) +
        Math.min(8, matchingLifestyle * 2) +
        (location.distanceBand === "LOCAL" || location.distanceBand === "NEARBY" ? 5 : 0),
    ),
  );
  const reasons: string[] = [];
  if (sharedIntentCount > 0) reasons.push("Your relationship intentions align");
  if (sharedInterests.length > 0) reasons.push(`You share ${sharedInterests.slice(0, 2).join(" and ")}`);
  if (scheduleOverlap) reasons.push(scheduleOverlap);
  if (reasons.length === 0) reasons.push("A thoughtful match based on your preferences");
  return { score, reasons: reasons.slice(0, 3), sharedInterests, scheduleOverlap };
}

function describePublicScheduleOverlap(
  viewer: ViewerDiscoveryContext,
  candidate: CandidateDiscoveryRecord,
): string | null {
  const left = viewer.schedulePreference;
  const right = candidate.schedulePreference;
  if (!left || !right) return null;
  const days = left.weekdayMask & right.weekdayMask;
  const times = left.timeBlockMask & right.timeBlockMask;
  const dayLabel = (days & 96) > 0 || (left.prefersWeekends && right.prefersWeekends)
    ? "Weekend availability overlaps"
    : (days & 31) > 0
      ? "Weekday availability overlaps"
      : null;
  if (!dayLabel) return null;
  const timeLabel = (times & 1) > 0 ? " in the morning" : (times & 2) > 0 ? " in the afternoon" : (times & 4) > 0 ? " in the evening" : "";
  return `${dayLabel}${timeLabel}`;
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
    !Number.isSafeInteger(decoded.nextIndex) || decoded.nextIndex < 0 ||
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
