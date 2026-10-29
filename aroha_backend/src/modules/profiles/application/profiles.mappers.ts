import type { ProfileCompletionStatus } from "../../../common/services/profile-completion.service";
import type { ProfileCompletionStatusDto } from "../../auth/dto/auth.dto";
import type {
  ConnectionIntentValue,
  CommunicationPreferenceDto,
  DiscoveryPreferenceDto,
  InterestTagDto,
  LifestyleDto,
  MyProfileDto,
  PrivatePhotoDto,
  SchedulePreferenceDto,
} from "../dto/profiles.dto";
import {
  PROFILE_PROMPT_IDS,
  type ProfilePromptId,
} from "../domain/profile-prompts";
import type { ProfileAggregateRecord } from "../infrastructure/profiles.infrastructure";
import type { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";

export function buildProfileCompletionInput(aggregate: ProfileAggregateRecord) {
  return {
    accountIsActive: aggregate.status === "ACTIVE" && aggregate.deletedAt === null,
    profileHidden: aggregate.profile?.isHidden ?? false,
    displayName: aggregate.profile?.displayName ?? null,
    bio: aggregate.profile?.bio ?? null,
    dateOfBirth: aggregate.profile?.dateOfBirth ?? null,
    city: aggregate.profile?.city ?? null,
    region: aggregate.profile?.region ?? null,
    countryCode: aggregate.profile?.countryCode ?? null,
    locationLat: aggregate.profile?.locationLat ?? null,
    locationLng: aggregate.profile?.locationLng ?? null,
    locationGeohash: aggregate.profile?.locationGeohash ?? null,
    activeIntentCount: aggregate.intents.length,
    approvedPhotoCount: aggregate.photos.filter(
      (photo) =>
        photo.deletedAt === null && photo.moderationStatus === "APPROVED",
    ).length,
    approvedPrimaryPhotoCount: aggregate.photos.filter(
      (photo) =>
        photo.deletedAt === null &&
        photo.moderationStatus === "APPROVED" &&
        photo.isPrimary,
    ).length,
    discoveryPreference: aggregate.discoveryPreference
      ? {
          minAge: aggregate.discoveryPreference.minAge,
          maxAge: aggregate.discoveryPreference.maxAge,
          maxDistanceKm: aggregate.discoveryPreference.maxDistanceKm,
        }
      : null,
    communicationPreferenceExists: !!aggregate.communicationPreference,
    completedAt: aggregate.profile?.completedAt ?? null,
  };
}

export function mapProfileCompletion(
  completion: ProfileCompletionStatus,
): ProfileCompletionStatusDto {
  return {
    isComplete: completion.isComplete,
    completedAt: completion.completedAt?.toISOString() ?? null,
    missingCriteria: completion.missingCriteria,
  };
}

export async function mapPrivatePhotoDto(
  photo: {
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
    moderationStatus: "PENDING" | "APPROVED" | "REJECTED";
    moderationReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  objectStorageService: ObjectStorageService,
): Promise<PrivatePhotoDto> {
  return {
    id: photo.id,
    objectKey: photo.objectKey,
    bucket: photo.bucket,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    width: photo.width,
    height: photo.height,
    position: photo.position,
    isPrimary: photo.isPrimary,
    purpose: photo.purpose,
    moderationStatus: photo.moderationStatus,
    moderationReason: photo.moderationReason,
    url: await objectStorageService.createPresignedGetObject({
      bucket: photo.bucket,
      objectKey: photo.objectKey,
    }),
    createdAt: photo.createdAt.toISOString(),
    updatedAt: photo.updatedAt.toISOString(),
  };
}

export function mapLifestyleDto(
  aggregate: ProfileAggregateRecord,
): LifestyleDto {
  return {
    smoking: aggregate.lifestyle?.smoking ?? null,
    drinking: aggregate.lifestyle?.drinking ?? null,
    exercise: aggregate.lifestyle?.exercise ?? null,
    diet: aggregate.lifestyle?.diet ?? null,
    petPreference: aggregate.lifestyle?.petPreference ?? null,
    sleepPattern: aggregate.lifestyle?.sleepPattern ?? null,
    socialEnergy: aggregate.lifestyle?.socialEnergy ?? null,
  };
}

export function mapSchedulePreferenceDto(
  aggregate: ProfileAggregateRecord,
): SchedulePreferenceDto {
  return {
    weekdayMask: aggregate.schedulePreference?.weekdayMask ?? 0,
    timeBlockMask: aggregate.schedulePreference?.timeBlockMask ?? 0,
    prefersWeekends: aggregate.schedulePreference?.prefersWeekends ?? false,
    remoteFriendly: aggregate.schedulePreference?.remoteFriendly ?? false,
    maxMeetupsPerWeek: aggregate.schedulePreference?.maxMeetupsPerWeek ?? null,
    preferredLeadTimeDays:
      aggregate.schedulePreference?.preferredLeadTimeDays ?? null,
    timezone: aggregate.schedulePreference?.timezone ?? null,
  };
}

export function mapDiscoveryPreferenceDto(
  aggregate: ProfileAggregateRecord,
): DiscoveryPreferenceDto {
  return {
    interestTagIds: aggregate.discoveryPreference?.interestTagIds ?? [],
    languageFilter: aggregate.discoveryPreference?.languageFilter ?? [],
    occupationFilter: aggregate.discoveryPreference?.occupationFilter ?? null,
    occupationCategoryFilter: aggregate.discoveryPreference?.occupationCategoryFilter ?? [],
    smokingFilter: aggregate.discoveryPreference?.smokingFilter ?? [],
    drinkingFilter: aggregate.discoveryPreference?.drinkingFilter ?? [],
    exerciseFilter: aggregate.discoveryPreference?.exerciseFilter ?? [],
    minAge: aggregate.discoveryPreference?.minAge ?? null,
    maxAge: aggregate.discoveryPreference?.maxAge ?? null,
    maxDistanceKm: aggregate.discoveryPreference?.maxDistanceKm ?? null,
    intentFilter:
      (aggregate.discoveryPreference?.intentFilter ??
        []) as ConnectionIntentValue[],
    preferredGenders: aggregate.discoveryPreference?.preferredGenders ?? [],
    includeRecentlyActiveOnly:
      aggregate.discoveryPreference?.includeRecentlyActiveOnly ?? false,
    preferSameCity: aggregate.discoveryPreference?.preferSameCity ?? false,
  };
}

export function mapCommunicationPreferenceDto(
  aggregate: ProfileAggregateRecord,
): CommunicationPreferenceDto {
  return {
    allowVoiceCalls: aggregate.communicationPreference?.allowVoiceCalls ?? true,
    allowVideoCalls: aggregate.communicationPreference?.allowVideoCalls ?? true,
    allowPushMatches: aggregate.communicationPreference?.allowPushMatches ?? true,
    allowPushMessages:
      aggregate.communicationPreference?.allowPushMessages ?? true,
    allowPushCalls: aggregate.communicationPreference?.allowPushCalls ?? true,
    allowReadReceipts:
      aggregate.communicationPreference?.allowReadReceipts ?? true,
  };
}

export function mapInterestTagDto(
  aggregate: ProfileAggregateRecord,
): InterestTagDto[] {
  return aggregate.interests.map((userInterest) => ({
    id: userInterest.interestTag.id,
    slug: userInterest.interestTag.slug,
    displayName: userInterest.interestTag.displayName,
    category: userInterest.interestTag.category,
  }));
}

export async function mapMyProfileDto(
  aggregate: ProfileAggregateRecord,
  completion: ProfileCompletionStatus,
  objectStorageService: ObjectStorageService,
): Promise<MyProfileDto> {
  const photos = await Promise.all(
    aggregate.photos.map((photo) =>
      mapPrivatePhotoDto(photo, objectStorageService),
    ),
  );

  return {
    userId: aggregate.id,
    displayName: aggregate.profile?.displayName ?? null,
    headline: aggregate.profile?.headline ?? null,
    bio: aggregate.profile?.bio ?? null,
    dateOfBirth: aggregate.profile?.dateOfBirth?.toISOString() ?? null,
    gender: aggregate.profile?.gender ?? null,
    pronouns: aggregate.profile?.pronouns ?? null,
    city: aggregate.profile?.city ?? null,
    region: aggregate.profile?.region ?? null,
    countryCode: aggregate.profile?.countryCode ?? null,
    locationLat: aggregate.profile?.locationLat
      ? Number(aggregate.profile.locationLat.toString())
      : null,
    locationLng: aggregate.profile?.locationLng
      ? Number(aggregate.profile.locationLng.toString())
      : null,
    hideAge: aggregate.profile?.hideAge ?? false,
    hideDistance: aggregate.profile?.hideDistance ?? false,
    isHidden: aggregate.profile?.isHidden ?? false,
    isIncognito: aggregate.profile?.isIncognito ?? false,
    hideFromContacts: aggregate.profile?.hideFromContacts ?? false,
    isPaused: aggregate.profile?.isPaused ?? false,
    verificationStatus: aggregate.profile?.verificationStatus ?? "UNVERIFIED",
    preferredRelationshipPace:
      aggregate.profile?.preferredRelationshipPace ?? null,
    occupation: aggregate.profile?.occupation ?? null,
    occupationCategory: aggregate.profile?.occupationCategory ?? null,
    shareWorkDetails: aggregate.profile?.shareWorkDetails ?? false,
    languages: aggregate.profile?.languages ?? [],
    foodPreferences: aggregate.profile?.foodPreferences ?? [],
    relocationOpenness: aggregate.profile?.relocationOpenness ?? null,
    careerPriority: aggregate.profile?.careerPriority ?? null,
    familyInvolvementComfort:
      aggregate.profile?.familyInvolvementComfort ?? null,
    marriageTimeline: aggregate.profile?.marriageTimeline ?? null,
    childrenPreference: aggregate.profile?.childrenPreference ?? null,
    religionSpirituality: aggregate.profile?.religionSpirituality ?? null,
    shareSensitiveCompatibility:
      aggregate.profile?.shareSensitiveCompatibility ?? false,
    promptResponses: normalizePromptResponses(
      aggregate.profile?.promptResponses,
    ),
    isComplete: completion.isComplete,
    completedAt: completion.completedAt?.toISOString() ?? null,
    photos,
    intents: aggregate.intents.map(
      (intent) => intent.intent as ConnectionIntentValue,
    ),
    interests: mapInterestTagDto(aggregate),
    lifestyle: mapLifestyleDto(aggregate),
    schedulePreference: mapSchedulePreferenceDto(aggregate),
    discoveryPreference: mapDiscoveryPreferenceDto(aggregate),
    communicationPreference: mapCommunicationPreferenceDto(aggregate),
    completion: mapProfileCompletion(completion),
    createdAt: aggregate.profile?.createdAt.toISOString() ?? aggregate.createdAt.toISOString(),
    updatedAt: aggregate.profile?.updatedAt.toISOString() ?? aggregate.updatedAt.toISOString(),
  };
}

function normalizePromptResponses(
  value: unknown,
): Array<{ promptId: ProfilePromptId; answer: string }> {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(PROFILE_PROMPT_IDS);
  return value
    .filter(
      (entry): entry is { promptId: ProfilePromptId; answer: string } =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { promptId?: unknown }).promptId === "string" &&
        allowed.has((entry as { promptId: string }).promptId) &&
        typeof (entry as { answer?: unknown }).answer === "string",
    )
    .map((entry) => ({ promptId: entry.promptId, answer: entry.answer }))
    .slice(0, 3);
}
