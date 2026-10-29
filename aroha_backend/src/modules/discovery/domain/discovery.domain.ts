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
  assertViewerCanAccess(
    viewer: ViewerDiscoveryContext | null,
  ): asserts viewer is ViewerDiscoveryContext {
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

    if (
      !viewer.profile ||
      !viewer.profile.isComplete ||
      viewer.profile.isHidden ||
      viewer.profile.isPaused
    ) {
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
      return {
        eligible: false,
        distanceKm: Number.POSITIVE_INFINITY,
        primaryIntentBucket: "NONE",
      };
    }

    if (
      !viewer.profile?.dateOfBirth ||
      viewer.profile.locationLat === null ||
      viewer.profile.locationLng === null ||
      !candidate.profile?.dateOfBirth ||
      candidate.profile.locationLat === null ||
      candidate.profile.locationLng === null
    ) {
      return {
        eligible: false,
        distanceKm: Number.POSITIVE_INFINITY,
        primaryIntentBucket: "NONE",
      };
    }

    const candidateAge = calculateAge(candidate.profile.dateOfBirth);
    const viewerAge = calculateAge(viewer.profile.dateOfBirth);
    const preference = candidate.discoveryPreference;
    if (
      candidateAge < 18 ||
      viewerAge < 18 ||
      (preference?.minAge != null && viewerAge < preference.minAge) ||
      (preference?.maxAge != null && viewerAge > preference.maxAge) ||
      (preference?.preferredGenders.length &&
        (!viewer.profile.gender ||
          !preference.preferredGenders.includes(viewer.profile.gender)))
    ) {
      return {
        eligible: false,
        distanceKm: Number.POSITIVE_INFINITY,
        primaryIntentBucket: "NONE",
      };
    }
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

    const filters = viewer.discoveryPreference;
    const normalize = (value: string) => value.trim().toLocaleLowerCase();
    // Rechecked for freshly loaded cached candidates as well as new recommendations.
    // Never search private occupation data: matching itself could disclose it.
    const interests = filters?.interestTagIds ?? [];
    const languages = (filters?.languageFilter ?? [])
      .map(normalize)
      .filter(Boolean);
    const workCategories = filters?.occupationCategoryFilter ?? [];
    const occupation = normalize(filters?.occupationFilter ?? "");
    if (
      (interests.length > 0 &&
        !candidate.interests.some((item) =>
          interests.includes(item.interestTagId),
        )) ||
      (languages.length > 0 &&
        !candidate.profile.languages.some((value) =>
          languages.includes(normalize(value)),
        )) ||
      (workCategories.length > 0 &&
        (!candidate.profile.shareWorkDetails ||
          !candidate.profile.occupationCategory ||
          !workCategories.includes(candidate.profile.occupationCategory))) ||
      (occupation &&
        (!candidate.profile.shareWorkDetails ||
          !normalize(candidate.profile.occupation ?? "").includes(
            occupation,
          ))) ||
      ((filters?.smokingFilter?.length ?? 0) > 0 &&
        (!candidate.lifestyle?.smoking ||
          !filters!.smokingFilter.includes(candidate.lifestyle.smoking))) ||
      ((filters?.drinkingFilter?.length ?? 0) > 0 &&
        (!candidate.lifestyle?.drinking ||
          !filters!.drinkingFilter.includes(candidate.lifestyle.drinking))) ||
      ((filters?.exerciseFilter?.length ?? 0) > 0 &&
        (!candidate.lifestyle?.exercise ||
          !filters!.exerciseFilter.includes(candidate.lifestyle.exercise))) ||
      (filters?.includeRecentlyActiveOnly &&
        (!candidate.lastActiveAt ||
          candidate.lastActiveAt.getTime() <
            Date.now() - 7 * 24 * 60 * 60 * 1000))
    ) {
      return { eligible: false, distanceKm, primaryIntentBucket: "NONE" };
    }

    const candidateIntentSet = new Set<string>(
      preference?.intentFilter?.length
        ? preference.intentFilter
        : candidate.intents.map((intent) => intent.intent),
    );
    const overlappingIntents = input.selectedIntents.filter((intent) =>
      candidateIntentSet.has(intent),
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
    const intentScore = 30 * overlapRatio(selectedIntents, candidateIntents);
    const interestScore =
      20 *
      jaccardIndex(
        viewer.interests.map((interest) => interest.interestTagId),
        candidate.interests.map((interest) => interest.interestTagId),
      );
    const lifestyleScore =
      15 *
      normalizedLifestyleCompatibility(viewer.lifestyle, candidate.lifestyle);
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
        [
          candidate.profile?.city,
          candidate.profile?.region,
          candidate.profile?.countryCode,
        ]
          .filter(Boolean)
          .join("|") || "UNKNOWN",
      recentlyServed: input.recentlyServed,
    };
  }
}

@Injectable()
export class DiscoveryDiversityService {
  orderCandidates(
    input: ScoredDiscoveryCandidate[],
  ): ScoredDiscoveryCandidate[] {
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
  return hashWithPepper(
    JSON.stringify(value),
    "discovery-preference-hash",
  ).slice(0, 32);
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

  const comparable = pairs.filter(
    ([leftValue, rightValue]) => leftValue && rightValue,
  );
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
    (((preferenceMatches[0] ?? 0) + (preferenceMatches[1] ?? 0)) / 2) * 0.2
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
