import { Type } from "class-transformer";
import {
  ArrayUnique,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from "class-validator";
import type { ProfileCompletionStatusDto } from "../../auth/dto/auth.dto";
import { PROFILE_PROMPT_IDS, type ProfilePromptId } from "../domain/profile-prompts";

export const PROFILE_GENDER_VALUES = [
  "WOMAN",
  "MAN",
  "NON_BINARY",
  "TRANS_WOMAN",
  "TRANS_MAN",
  "AGENDER",
  "OTHER",
  "PREFER_NOT_TO_SAY",
] as const;

export const CONNECTION_INTENT_VALUES = [
  "FRIENDSHIP",
  "COMPANIONSHIP",
  "SHARED_INTERESTS",
  "RELATIONSHIP",
  "DATING",
  "COMMITTED_RELATIONSHIP",
  "MARRIAGE_MINDED",
] as const;

export const RELATIONSHIP_PACE_VALUES = [
  "SLOW_AND_STEADY",
  "OPEN_TO_EXPLORING",
  "INTENTIONAL",
  "READY_TO_COMMIT",
] as const;

export const PHOTO_MODERATION_STATUS_VALUES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export const PHOTO_PURPOSE_VALUES = ["PROFILE", "SCENE"] as const;

export const SMOKING_HABIT_VALUES = [
  "NEVER",
  "OCCASIONAL",
  "REGULAR",
  "PREFER_NOT_TO_SAY",
] as const;

export const DRINKING_HABIT_VALUES = [
  "NEVER",
  "OCCASIONAL",
  "SOCIAL",
  "REGULAR",
  "PREFER_NOT_TO_SAY",
] as const;

export const EXERCISE_HABIT_VALUES = [
  "NEVER",
  "OCCASIONAL",
  "WEEKLY",
  "FREQUENT",
] as const;

export const DIET_PREFERENCE_VALUES = [
  "OMNIVORE",
  "VEGETARIAN",
  "VEGAN",
  "PESCATARIAN",
  "HALAL",
  "KOSHER",
  "OTHER",
  "PREFER_NOT_TO_SAY",
] as const;

export const PET_PREFERENCE_VALUES = [
  "HAS_PETS",
  "LIKES_PETS",
  "NO_PETS",
  "ALLERGIC",
  "PREFER_NOT_TO_SAY",
] as const;

export const SLEEP_PATTERN_VALUES = [
  "EARLY_BIRD",
  "FLEXIBLE",
  "NIGHT_OWL",
] as const;

export const SOCIAL_ENERGY_VALUES = [
  "LOW_KEY",
  "BALANCED",
  "OUTGOING",
] as const;

export const PROFILE_PHOTO_MIME_TYPE_VALUES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ProfileGenderValue = (typeof PROFILE_GENDER_VALUES)[number];
export type ConnectionIntentValue = (typeof CONNECTION_INTENT_VALUES)[number];
export type RelationshipPaceValue = (typeof RELATIONSHIP_PACE_VALUES)[number];
export type PhotoModerationStatusValue =
  (typeof PHOTO_MODERATION_STATUS_VALUES)[number];
export type PhotoPurposeValue = (typeof PHOTO_PURPOSE_VALUES)[number];
export type SmokingHabitValue = (typeof SMOKING_HABIT_VALUES)[number];
export type DrinkingHabitValue = (typeof DRINKING_HABIT_VALUES)[number];
export type ExerciseHabitValue = (typeof EXERCISE_HABIT_VALUES)[number];
export type DietPreferenceValue = (typeof DIET_PREFERENCE_VALUES)[number];
export type PetPreferenceValue = (typeof PET_PREFERENCE_VALUES)[number];
export type SleepPatternValue = (typeof SLEEP_PATTERN_VALUES)[number];
export type SocialEnergyValue = (typeof SOCIAL_ENERGY_VALUES)[number];
export type ProfilePhotoMimeTypeValue =
  (typeof PROFILE_PHOTO_MIME_TYPE_VALUES)[number];

export class ProfileLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  readonly lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  readonly lng!: number;
}

export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly displayName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  readonly headline?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(1000)
  readonly bio?: string | null;

  @IsOptional()
  @IsISO8601({
    strict: true,
    strictSeparator: true,
  })
  readonly dateOfBirth?: string | null;

  @IsOptional()
  @IsIn(PROFILE_GENDER_VALUES)
  readonly gender?: ProfileGenderValue | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly pronouns?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly region?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  readonly countryCode?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileLocationDto)
  readonly location?: ProfileLocationDto;

  @IsOptional()
  @IsBoolean()
  readonly hideAge?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly hideDistance?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly isHidden?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly isIncognito?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly hideFromContacts?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly isPaused?: boolean;

  @IsOptional()
  @IsIn(RELATIONSHIP_PACE_VALUES)
  readonly preferredRelationshipPace?: RelationshipPaceValue | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  readonly languages?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  readonly foodPreferences?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly relocationOpenness?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly careerPriority?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly familyInvolvementComfort?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly marriageTimeline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly childrenPreference?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly religionSpirituality?: string | null;

  @IsOptional()
  @IsBoolean()
  readonly shareSensitiveCompatibility?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ProfilePromptResponseInputDto)
  readonly promptResponses?: ProfilePromptResponseInputDto[];
}

export class ProfilePromptResponseInputDto {
  @IsIn(PROFILE_PROMPT_IDS)
  readonly promptId!: ProfilePromptId;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  readonly answer!: string;
}

export class UpdateLifestyleDto {
  @IsOptional()
  @IsIn(SMOKING_HABIT_VALUES)
  readonly smoking?: SmokingHabitValue | null;

  @IsOptional()
  @IsIn(DRINKING_HABIT_VALUES)
  readonly drinking?: DrinkingHabitValue | null;

  @IsOptional()
  @IsIn(EXERCISE_HABIT_VALUES)
  readonly exercise?: ExerciseHabitValue | null;

  @IsOptional()
  @IsIn(DIET_PREFERENCE_VALUES)
  readonly diet?: DietPreferenceValue | null;

  @IsOptional()
  @IsIn(PET_PREFERENCE_VALUES)
  readonly petPreference?: PetPreferenceValue | null;

  @IsOptional()
  @IsIn(SLEEP_PATTERN_VALUES)
  readonly sleepPattern?: SleepPatternValue | null;

  @IsOptional()
  @IsIn(SOCIAL_ENERGY_VALUES)
  readonly socialEnergy?: SocialEnergyValue | null;
}

export class UpdateSchedulePreferenceDto {
  @IsInt()
  @Min(0)
  readonly weekdayMask!: number;

  @IsInt()
  @Min(0)
  readonly timeBlockMask!: number;

  @IsBoolean()
  readonly prefersWeekends!: boolean;

  @IsBoolean()
  readonly remoteFriendly!: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  readonly maxMeetupsPerWeek?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  readonly preferredLeadTimeDays?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly timezone?: string | null;
}

export class UpdateDiscoveryPreferenceDto {
  @IsInt()
  @Min(18)
  readonly minAge!: number;

  @IsInt()
  @Min(18)
  readonly maxAge!: number;

  @IsInt()
  @Min(1)
  readonly maxDistanceKm!: number;

  @IsArray()
  @ArrayUnique()
  @IsIn(CONNECTION_INTENT_VALUES, { each: true })
  readonly intentFilter!: ConnectionIntentValue[];

  @IsArray()
  @ArrayUnique()
  @IsIn(PROFILE_GENDER_VALUES, { each: true })
  readonly preferredGenders!: ProfileGenderValue[];

  @IsBoolean()
  readonly includeRecentlyActiveOnly!: boolean;

  @IsBoolean()
  readonly preferSameCity!: boolean;
}

export class UpdateCommunicationPreferenceDto {
  @IsBoolean()
  readonly allowVoiceCalls!: boolean;

  @IsBoolean()
  readonly allowVideoCalls!: boolean;

  @IsBoolean()
  readonly allowPushMatches!: boolean;

  @IsBoolean()
  readonly allowPushMessages!: boolean;

  @IsBoolean()
  readonly allowPushCalls!: boolean;

  @IsBoolean()
  readonly allowReadReceipts!: boolean;
}

export class InitiateProfilePhotoUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  readonly fileName!: string;

  @IsIn(PROFILE_PHOTO_MIME_TYPE_VALUES)
  readonly mimeType!: ProfilePhotoMimeTypeValue;

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  readonly sizeBytes!: number;

  @IsOptional()
  @IsIn(PHOTO_PURPOSE_VALUES)
  readonly purpose?: PhotoPurposeValue;

  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  readonly sha256?: string | null;
}

export class FinalizeProfilePhotoUploadDto {
  @IsString()
  @IsNotEmpty()
  readonly uploadToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  readonly objectKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  readonly bucket!: string;

  @IsIn(PROFILE_PHOTO_MIME_TYPE_VALUES)
  readonly mimeType!: ProfilePhotoMimeTypeValue;

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  readonly sizeBytes!: number;

  @IsInt()
  @Min(1)
  readonly width!: number;

  @IsInt()
  @Min(1)
  readonly height!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  readonly sha256?: string | null;

  @IsInt()
  @Min(0)
  readonly position!: number;
}

export class ReorderProfilePhotosDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  readonly orderedPhotoIds!: string[];
}

export interface InterestTagDto {
  id: string;
  slug: string;
  displayName: string;
  category: string | null;
}

export interface LifestyleDto {
  smoking: SmokingHabitValue | null;
  drinking: DrinkingHabitValue | null;
  exercise: ExerciseHabitValue | null;
  diet: DietPreferenceValue | null;
  petPreference: PetPreferenceValue | null;
  sleepPattern: SleepPatternValue | null;
  socialEnergy: SocialEnergyValue | null;
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
  intentFilter: ConnectionIntentValue[];
  preferredGenders: ProfileGenderValue[];
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
  purpose: PhotoPurposeValue;
  moderationStatus: PhotoModerationStatusValue;
  moderationReason: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface MyProfileDto {
  userId: string;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  dateOfBirth: string | null;
  gender: ProfileGenderValue | null;
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
  verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  preferredRelationshipPace: RelationshipPaceValue | null;
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
  intents: ConnectionIntentValue[];
  interests: InterestTagDto[];
  lifestyle: LifestyleDto;
  schedulePreference: SchedulePreferenceDto;
  discoveryPreference: DiscoveryPreferenceDto;
  communicationPreference: CommunicationPreferenceDto;
  completion: ProfileCompletionStatusDto;
  createdAt: string;
  updatedAt: string;
}

export interface MyProfileResponseDto {
  profile: MyProfileDto;
}

export interface InitiateProfilePhotoUploadResponseDto {
  uploadToken: string;
  objectKey: string;
  bucket: string;
  method: "PUT";
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
  maxSizeBytes: number;
}

export interface FinalizeProfilePhotoUploadResponseDto {
  photo: PrivatePhotoDto;
  profileCompletion: ProfileCompletionStatusDto;
}

export interface ProfilePhotoResponseDto {
  photo: PrivatePhotoDto;
}

export interface ProfilePhotoListResponseDto {
  photos: PrivatePhotoDto[];
}

export interface PreferenceValueResponseDto<TValue> {
  value: TValue;
}
