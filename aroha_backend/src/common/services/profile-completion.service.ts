import { Injectable } from "@nestjs/common";

export const PROFILE_COMPLETION_CRITERIA = [
  "DISPLAY_NAME",
  "BIO",
  "DATE_OF_BIRTH",
  "AGE_18_PLUS",
  "CITY",
  "REGION",
  "COUNTRY_CODE",
  "LOCATION_COORDINATES",
  "LOCATION_GEOHASH",
  "INTENT",
  "APPROVED_PHOTO",
  "APPROVED_PRIMARY_PHOTO",
  "DISCOVERY_PREFERENCE",
  "COMMUNICATION_PREFERENCE",
  "PROFILE_HIDDEN",
  "ACCOUNT_NOT_ACTIVE",
] as const;

export type ProfileCompletionCriterion =
  (typeof PROFILE_COMPLETION_CRITERIA)[number];

type CoordinateValue = string | number | { toString(): string };

export interface ProfileCompletionEvaluationInput {
  accountIsActive: boolean;
  profileHidden: boolean;
  displayName: string | null;
  bio: string | null;
  dateOfBirth: Date | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  locationLat: CoordinateValue | null;
  locationLng: CoordinateValue | null;
  locationGeohash: string | null;
  activeIntentCount: number;
  approvedPhotoCount: number;
  approvedPrimaryPhotoCount: number;
  discoveryPreference: {
    minAge: number | null;
    maxAge: number | null;
    maxDistanceKm: number | null;
  } | null;
  communicationPreferenceExists: boolean;
  completedAt: Date | null;
}

export interface ProfileCompletionStatus {
  isComplete: boolean;
  completedAt: Date | null;
  missingCriteria: ProfileCompletionCriterion[];
}

export interface PersistedProfileCompletionStateInput {
  previousIsComplete: boolean;
  previousCompletedAt: Date | null;
  evaluated: ProfileCompletionStatus;
  now: Date;
}

@Injectable()
export class ProfileCompletionService {
  evaluate(input: ProfileCompletionEvaluationInput): ProfileCompletionStatus {
    const missing = new Set<ProfileCompletionCriterion>();

    if (!input.accountIsActive) {
      missing.add("ACCOUNT_NOT_ACTIVE");
    }
    if (input.profileHidden) {
      missing.add("PROFILE_HIDDEN");
    }
    if (!input.displayName || input.displayName.trim().length < 2) {
      missing.add("DISPLAY_NAME");
    }
    const normalizedBioLength = input.bio?.trim().length ?? 0;
    if (normalizedBioLength < 20 || normalizedBioLength > 1000) {
      missing.add("BIO");
    }
    if (!input.dateOfBirth) {
      missing.add("DATE_OF_BIRTH");
    } else if (calculateAge(input.dateOfBirth) < 18) {
      missing.add("AGE_18_PLUS");
    }
    if (!input.city) {
      missing.add("CITY");
    }
    if (!input.region) {
      missing.add("REGION");
    }
    if (!input.countryCode) {
      missing.add("COUNTRY_CODE");
    }
    if (input.locationLat === null || input.locationLng === null) {
      missing.add("LOCATION_COORDINATES");
    }
    if (!input.locationGeohash) {
      missing.add("LOCATION_GEOHASH");
    }
    if (input.activeIntentCount < 1) {
      missing.add("INTENT");
    }
    if (input.approvedPhotoCount < 1) {
      missing.add("APPROVED_PHOTO");
    }
    if (input.approvedPrimaryPhotoCount < 1) {
      missing.add("APPROVED_PRIMARY_PHOTO");
    }

    const discoveryPreference = input.discoveryPreference;
    if (
      !discoveryPreference ||
      discoveryPreference.minAge === null ||
      discoveryPreference.maxAge === null ||
      discoveryPreference.maxDistanceKm === null ||
      discoveryPreference.minAge < 18 ||
      discoveryPreference.maxAge < discoveryPreference.minAge ||
      discoveryPreference.maxDistanceKm < 1
    ) {
      missing.add("DISCOVERY_PREFERENCE");
    }

    if (!input.communicationPreferenceExists) {
      missing.add("COMMUNICATION_PREFERENCE");
    }

    return {
      isComplete: missing.size === 0,
      completedAt: input.completedAt,
      missingCriteria: Array.from(missing),
    };
  }
}

export function resolvePersistedProfileCompletionState(
  input: PersistedProfileCompletionStateInput,
): ProfileCompletionStatus {
  const completedAt = input.evaluated.isComplete
    ? input.previousIsComplete
      ? input.previousCompletedAt ?? input.now
      : input.now
    : input.previousCompletedAt;

  return {
    isComplete: input.evaluated.isComplete,
    completedAt,
    missingCriteria: input.evaluated.missingCriteria,
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
