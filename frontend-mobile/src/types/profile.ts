import type {
  ConnectionIntent,
  DietPreference,
  DistanceBand,
  DrinkingHabit,
  ExerciseHabit,
  PetPreference,
  PhotoModerationStatus,
  ProfileGender,
  ProfilePromptId,
  ProfileVerificationStatus,
  RelationshipPace,
  SleepPattern,
  SmokingHabit,
  SocialEnergyLevel,
} from "./enums";
import type { ProfileCompletionStatusDto } from "./auth";
import type { ProfilePhotoMimeType } from "./media";

export interface InterestTagDto {
  id: string;
  slug: string;
  displayName: string;
  category: string | null;
}

export interface InterestTagPageDto {
  items: InterestTagDto[];
  nextCursor: string | null;
}

export interface InterestCatalogQuery {
  cursor?: string;
  limit?: number;
  search?: string;
}

export interface LifestyleDto {
  smoking: SmokingHabit | null;
  drinking: DrinkingHabit | null;
  exercise: ExerciseHabit | null;
  diet: DietPreference | null;
  petPreference: PetPreference | null;
  sleepPattern: SleepPattern | null;
  socialEnergy: SocialEnergyLevel | null;
}

export interface SchedulePreferenceDto {
  weekdayMask: number;
  timeBlockMask: number;
  prefersWeekends: boolean;
  remoteFriendly: boolean;
  maxMeetupsPerWeek: number | null;
  preferredLeadTimeDays: number | null;
  timezone: string | null;
}

export interface DiscoveryPreferenceDto {
  minAge: number | null;
  maxAge: number | null;
  maxDistanceKm: number | null;
  intentFilter: ConnectionIntent[];
  preferredGenders: ProfileGender[];
  includeRecentlyActiveOnly: boolean;
  preferSameCity: boolean;
}

export interface CommunicationPreferenceDto {
  allowVoiceCalls: boolean;
  allowVideoCalls: boolean;
  allowPushMatches: boolean;
  allowPushMessages: boolean;
  allowPushCalls: boolean;
  allowReadReceipts: boolean;
}

export type UpdateLifestyleRequest = Partial<LifestyleDto>;

export interface UpdateSchedulePreferenceRequest {
  weekdayMask: number;
  timeBlockMask: number;
  prefersWeekends: boolean;
  remoteFriendly: boolean;
  maxMeetupsPerWeek?: number | null;
  preferredLeadTimeDays?: number | null;
  timezone?: string | null;
}

export interface UpdateDiscoveryPreferenceRequest {
  minAge: number;
  maxAge: number;
  maxDistanceKm: number;
  intentFilter: ConnectionIntent[];
  preferredGenders: ProfileGender[];
  includeRecentlyActiveOnly: boolean;
  preferSameCity: boolean;
}

export type UpdateCommunicationPreferenceRequest = CommunicationPreferenceDto;

export interface UpdateMyInterestsResponseDto {
  interests: InterestTagDto[];
}

export interface UpdateMyIntentsResponseDto {
  intents: ConnectionIntent[];
  profileCompletion: ProfileCompletionStatusDto;
}

export interface PrivatePhotoDto {
  id: string;
  objectKey: string;
  bucket: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  position: number;
  isPrimary: boolean;
  purpose: "PROFILE" | "SCENE";
  moderationStatus: PhotoModerationStatus;
  moderationReason: string | null;
  // The backend exposes a signed `url` for the owner's photos so the client can render them.
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPhotoDto {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  isPrimary: boolean;
  position: number;
}

export interface MyProfileDto {
  userId: string;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  dateOfBirth: string | null;
  gender: ProfileGender | null;
  pronouns: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  locationLat: number | null;
  locationLng: number | null;
  hideAge: boolean;
  hideDistance: boolean;
  isHidden: boolean;
  isIncognito: boolean;
  hideFromContacts: boolean;
  isPaused: boolean;
  verificationStatus: ProfileVerificationStatus;
  preferredRelationshipPace: RelationshipPace | null;
  languages: string[];
  foodPreferences: string[];
  relocationOpenness: string | null;
  careerPriority: string | null;
  familyInvolvementComfort: string | null;
  marriageTimeline: string | null;
  childrenPreference: string | null;
  religionSpirituality: string | null;
  shareSensitiveCompatibility: boolean;
  promptResponses: Array<{ promptId: ProfilePromptId; answer: string }>;
  isComplete: boolean;
  completedAt: string | null;
  photos: PrivatePhotoDto[];
  intents: ConnectionIntent[];
  interests: InterestTagDto[];
  lifestyle: LifestyleDto;
  schedulePreference: SchedulePreferenceDto;
  discoveryPreference: DiscoveryPreferenceDto;
  communicationPreference: CommunicationPreferenceDto;
  completion: ProfileCompletionStatusDto;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateMyProfileRequest {
  displayName?: string | null;
  headline?: string | null;
  bio?: string | null;
  dateOfBirth?: string | null;
  gender?: ProfileGender | null;
  pronouns?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  location?: {
    lat: number;
    lng: number;
  };
  hideAge?: boolean;
  hideDistance?: boolean;
  isHidden?: boolean;
  isIncognito?: boolean;
  hideFromContacts?: boolean;
  isPaused?: boolean;
  preferredRelationshipPace?: RelationshipPace | null;
  languages?: string[];
  foodPreferences?: string[];
  relocationOpenness?: string | null;
  careerPriority?: string | null;
  familyInvolvementComfort?: string | null;
  marriageTimeline?: string | null;
  childrenPreference?: string | null;
  religionSpirituality?: string | null;
  shareSensitiveCompatibility?: boolean;
  promptResponses?: Array<{ promptId: ProfilePromptId; answer: string }>;
}

export interface PublicProfileDto {
  userId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  age: number | null;
  gender: ProfileGender | null;
  pronouns: string | null;
  verificationStatus: ProfileVerificationStatus;
  preferredRelationshipPace: RelationshipPace | null;
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
  location: {
    city: string | null;
    region: string | null;
    countryCode: string | null;
    distanceKmRounded: number;
    distanceBand: DistanceBand | null;
  };
  intents: ConnectionIntent[];
  interests: InterestTagDto[];
  lifestyle: LifestyleDto;
  photos: PublicPhotoDto[];
}

export interface InitiateProfilePhotoUploadRequest {
  fileName: string;
  mimeType: ProfilePhotoMimeType;
  sizeBytes: number;
  purpose?: "PROFILE" | "SCENE";
  sha256?: string | null;
}

export interface InitiateProfilePhotoUploadResponse {
  uploadToken: string;
  objectKey: string;
  bucket: string;
  method: "PUT";
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
  maxSizeBytes: number;
}

export interface FinalizeProfilePhotoUploadRequest {
  uploadToken: string;
  objectKey: string;
  bucket: string;
  mimeType: ProfilePhotoMimeType;
  sizeBytes: number;
  width: number;
  height: number;
  sha256?: string | null;
  position: number;
}

export interface FinalizeProfilePhotoUploadResponse {
  photo: PrivatePhotoDto;
  profileCompletion: ProfileCompletionStatusDto;
}

export interface ReorderProfilePhotosRequest {
  orderedPhotoIds: string[];
}

export interface ProfilePhotoListResponse {
  photos: PrivatePhotoDto[];
}

export interface ProfilePhotoResponse {
  photo: PrivatePhotoDto;
}
