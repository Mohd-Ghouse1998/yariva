import type {
  InterestTagDto,
  LifestyleDto,
} from "../../profiles/dto/profiles.dto";

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
  age: number | null;
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
  verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  preferredRelationshipPace:
    | "SLOW_AND_STEADY"
    | "OPEN_TO_EXPLORING"
    | "INTENTIONAL"
    | "READY_TO_COMMIT"
    | null;
  occupation: string | null;
  languages: string[];
  foodPreferences: string[];
  profilePrompts: Array<{ promptId: string; answer: string }>;
  compatibility: {
    score: number;
    reasons: string[];
    sharedInterests: string[];
    scheduleOverlap: string | null;
  };
  sensitiveCompatibility: {
    relocationOpenness: string | null;
    careerPriority: string | null;
    familyInvolvementComfort: string | null;
    marriageTimeline: string | null;
    childrenPreference: string | null;
    religionSpirituality: string | null;
  } | null;
  location: LocationSummaryDto;
  intents: Array<
    | "FRIENDSHIP"
    | "COMPANIONSHIP"
    | "SHARED_INTERESTS"
    | "RELATIONSHIP"
    | "DATING"
    | "COMMITTED_RELATIONSHIP"
    | "MARRIAGE_MINDED"
  >;
  interests: InterestTagDto[];
  lifestyle: LifestyleDto;
  photos: PublicPhotoDto[];
}

export interface DiscoveryFeedResponseDto {
  firstConnectionUserIds?: string[];
  items: PublicProfileDto[];
  nextCursor: string | null;
  snapshotExpiresAt: string;
  dailyLimit: number;
  remainingToday: number;
}
