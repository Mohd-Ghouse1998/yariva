import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import {
  haversineDistanceKm,
  resolveDistanceBand,
  roundDistanceKm,
} from "../../../common/utils/distance.util";
import { canonicalUserPair } from "../../../common/utils/pair.util";
import { AuditLogService } from "../../../common/services/audit-log.service";
import {
  ProfileCompletionService,
  resolvePersistedProfileCompletionState,
  type ProfileCompletionStatus,
} from "../../../common/services/profile-completion.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import {
  buildProfileCompletionInput,
  mapCommunicationPreferenceDto,
  mapDiscoveryPreferenceDto,
  mapLifestyleDto,
  mapMyProfileDto,
  mapSchedulePreferenceDto,
} from "./profiles.mappers";
import type {
  CommunicationPreferenceDto,
  MyProfileResponseDto,
  PreferenceValueResponseDto,
  SchedulePreferenceDto,
  UpdateCommunicationPreferenceDto,
  UpdateDiscoveryPreferenceDto,
  UpdateLifestyleDto,
  UpdateMyProfileDto,
  UpdateSchedulePreferenceDto,
  DiscoveryPreferenceDto,
  LifestyleDto,
} from "../dto/profiles.dto";
import {
  DiscoveryPreferencePolicyService,
  LocationPrivacyService,
  ProfileVisibilityPolicyService,
} from "../domain/profiles.domain";
import {
  ProfileAggregateRepository,
  UserCommunicationPreferenceRepository,
  UserDiscoveryPreferenceRepository,
  UserLifestyleRepository,
  UserProfileRepository,
  UserSchedulePreferenceRepository,
  type ProfileAggregateRecord,
} from "../infrastructure/profiles.infrastructure";
import { UserReaderService } from "../../users/application/users.services";
import { UserRepository } from "../../users/infrastructure/users.infrastructure";
import type { PublicProfileDto } from "../../discovery/dto/discovery.dto";
import { mapDatingProfileFields } from "../../discovery/application/public-profile-fields";

export interface ProfileActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class ProfileCompletionSyncService {
  constructor(
    private readonly profileAggregateRepository: ProfileAggregateRepository,
    private readonly userProfileRepository: UserProfileRepository,
    private readonly profileVisibilityPolicyService: ProfileVisibilityPolicyService,
    private readonly profileCompletionService: ProfileCompletionService,
  ) {}

  async recomputeAndPersist(
    userId: string,
    executor: PrismaTransactionalClient,
    now: Date,
  ): Promise<{
    aggregate: ProfileAggregateRecord;
    completion: ProfileCompletionStatus;
  }> {
    const aggregate = await this.profileAggregateRepository.findByUserId(
      userId,
      executor,
    );

    if (!aggregate) {
      throw new Error("User aggregate missing during completion sync");
    }

    this.profileVisibilityPolicyService.assertProfileExists(aggregate.profile);
    const profile = aggregate.profile;

    const evaluated = this.profileCompletionService.evaluate(
      buildProfileCompletionInput(aggregate),
    );
    const resolved = resolvePersistedProfileCompletionState({
      previousIsComplete: profile.isComplete,
      previousCompletedAt: profile.completedAt,
      evaluated,
      now,
    });

    await this.userProfileRepository.updateCompletionState(executor, userId, {
      isComplete: resolved.isComplete,
      completedAt: resolved.completedAt,
    });

    profile.isComplete = resolved.isComplete;
    profile.completedAt = resolved.completedAt;

    return {
      aggregate,
      completion: resolved,
    };
  }
}

@Injectable()
export class GetMyProfileService {
  constructor(
    private readonly userReaderService: UserReaderService,
    private readonly profileAggregateRepository: ProfileAggregateRepository,
    private readonly profileVisibilityPolicyService: ProfileVisibilityPolicyService,
    private readonly profileCompletionService: ProfileCompletionService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async execute(userId: string): Promise<MyProfileResponseDto> {
    await this.userReaderService.getRequiredById(userId);

    const aggregate = await this.profileAggregateRepository.findByUserId(userId);
    if (!aggregate) {
      throw new Error("User aggregate missing");
    }

    this.profileVisibilityPolicyService.assertProfileExists(aggregate.profile);
    const completion = this.profileCompletionService.evaluate(
      buildProfileCompletionInput(aggregate),
    );

    return {
      profile: await mapMyProfileDto(
        aggregate,
        completion,
        this.objectStorageService,
      ),
    };
  }
}

@Injectable()
export class GetPublicProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly profileAggregateRepository: ProfileAggregateRepository,
    private readonly profileVisibilityPolicyService: ProfileVisibilityPolicyService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async execute(input: {
    viewerId: string;
    targetUserId: string;
  }): Promise<{ profile: PublicProfileDto }> {
    await this.userReaderService.getRequiredById(input.viewerId);

    const [viewer, target] = await Promise.all([
      this.profileAggregateRepository.findByUserId(input.viewerId),
      this.profileAggregateRepository.findByUserId(input.targetUserId),
    ]);

    if (!viewer) {
      throw new AppException(404, ERROR_CODES.PROFILE_NOT_FOUND, "Profile not found");
    }
    if (!target) {
      throw new AppException(404, ERROR_CODES.PROFILE_NOT_FOUND, "Profile not found");
    }

    this.profileVisibilityPolicyService.assertProfileExists(target.profile);
    if (
      target.status !== "ACTIVE" ||
      target.isShadowBanned ||
      target.isDiscoveryFrozen
    ) {
      throw new AppException(404, ERROR_CODES.PROFILE_NOT_FOUND, "Profile not available");
    }

    const pair = canonicalUserPair(input.viewerId, input.targetUserId);
    const [activeBlock, activeLike, match] =
      input.viewerId === input.targetUserId
        ? [null, null, null]
        : await Promise.all([
            this.prisma.block.findFirst({
              where: {
                deletedAt: null,
                OR: [
                  { blockerId: input.viewerId, blockedId: input.targetUserId },
                  { blockerId: input.targetUserId, blockedId: input.viewerId },
                ],
              },
              select: { id: true },
            }),
            this.prisma.like.findFirst({
              where: {
                status: "ACTIVE",
                OR: [
                  { actorId: input.viewerId, targetId: input.targetUserId },
                  { actorId: input.targetUserId, targetId: input.viewerId },
                ],
              },
              select: { id: true },
            }),
            this.prisma.match.findUnique({
              where: { userLowId_userHighId: pair },
              select: { status: true },
            }),
          ]);

    if (activeBlock) {
      // Do not reveal which side initiated a block.
      throw new AppException(403, ERROR_CODES.FORBIDDEN, "Profile is not accessible");
    }

    const approvedPhotos = target.photos.filter(
      (photo) => photo.moderationStatus === "APPROVED" && photo.deletedAt === null,
    );
    const hasRelationshipAccess =
      input.viewerId === input.targetUserId || !!activeLike || match?.status === "ACTIVE";
    const isPubliclyViewable =
      target.profile.isComplete &&
      !target.profile.isHidden &&
      !target.profile.isPaused &&
      !target.profile.isIncognito &&
      approvedPhotos.length > 0;

    if (!hasRelationshipAccess && !isPubliclyViewable) {
      // Treat privacy and availability failures as not-found to avoid exposing
      // whether a private account exists to arbitrary authenticated callers.
      throw new AppException(404, ERROR_CODES.PROFILE_NOT_FOUND, "Profile not available");
    }

    return {
      profile: await mapAuthorizedPublicProfile(
        viewer,
        target,
        approvedPhotos,
        this.objectStorageService,
      ),
    };
  }
}

@Injectable()
export class UpdateProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly userProfileRepository: UserProfileRepository,
    private readonly profileCompletionSyncService: ProfileCompletionSyncService,
    private readonly locationPrivacyService: LocationPrivacyService,
    private readonly userRepository: UserRepository,
    private readonly auditLogService: AuditLogService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async execute(input: {
    userId: string;
    payload: UpdateMyProfileDto;
    metadata: ProfileActionMetadata;
  }): Promise<MyProfileResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    if (input.payload.promptResponses) {
      const promptIds = input.payload.promptResponses.map((prompt) => prompt.promptId);
      if (new Set(promptIds).size !== promptIds.length) {
        throw new AppException(
          400,
          ERROR_CODES.VALIDATION_FAILED,
          "Profile prompts must be unique",
        );
      }
    }

    const parsedDateOfBirth =
      input.payload.dateOfBirth === undefined
        ? undefined
        : input.payload.dateOfBirth === null
          ? null
          : parseDateOfBirthOrThrow(input.payload.dateOfBirth);

    this.locationPrivacyService.assertAdult(parsedDateOfBirth ?? undefined);
    const normalizedLocation = this.locationPrivacyService.normalizeLocation(
      input.payload.location,
    );
    const normalizedCountryCode = this.locationPrivacyService.normalizeCountryCode(
      input.payload.countryCode,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      await this.userProfileRepository.updateProfile(tx, input.userId, {
        ...(input.payload.displayName !== undefined
          ? { displayName: input.payload.displayName }
          : {}),
        ...(input.payload.headline !== undefined
          ? { headline: input.payload.headline }
          : {}),
        ...(input.payload.bio !== undefined ? { bio: input.payload.bio } : {}),
        ...(parsedDateOfBirth !== undefined
          ? { dateOfBirth: parsedDateOfBirth }
          : {}),
        ...(input.payload.gender !== undefined
          ? { gender: input.payload.gender }
          : {}),
        ...(input.payload.pronouns !== undefined
          ? { pronouns: input.payload.pronouns }
          : {}),
        ...(input.payload.city !== undefined ? { city: input.payload.city } : {}),
        ...(input.payload.region !== undefined
          ? { region: input.payload.region }
          : {}),
        ...(normalizedCountryCode !== undefined
          ? { countryCode: normalizedCountryCode }
          : {}),
        ...(normalizedLocation !== undefined
          ? {
              locationLat: normalizedLocation.lat,
              locationLng: normalizedLocation.lng,
              locationGeohash: normalizedLocation.geohash,
              locationUpdatedAt: new Date(),
            }
          : {}),
        ...(input.payload.hideAge !== undefined
          ? { hideAge: input.payload.hideAge }
          : {}),
        ...(input.payload.hideDistance !== undefined
          ? { hideDistance: input.payload.hideDistance }
          : {}),
        ...(input.payload.isHidden !== undefined
          ? { isHidden: input.payload.isHidden }
          : {}),
        ...(input.payload.isIncognito !== undefined
          ? { isIncognito: input.payload.isIncognito }
          : {}),
        ...(input.payload.hideFromContacts !== undefined
          ? { hideFromContacts: input.payload.hideFromContacts }
          : {}),
        ...(input.payload.isPaused !== undefined
          ? { isPaused: input.payload.isPaused }
          : {}),
        ...(input.payload.preferredRelationshipPace !== undefined
          ? { preferredRelationshipPace: input.payload.preferredRelationshipPace }
          : {}),
        ...(input.payload.languages !== undefined
          ? { languages: normalizeStringList(input.payload.languages) }
          : {}),
        ...(input.payload.foodPreferences !== undefined
          ? { foodPreferences: normalizeStringList(input.payload.foodPreferences) }
          : {}),
        ...(input.payload.relocationOpenness !== undefined
          ? { relocationOpenness: cleanOptionalString(input.payload.relocationOpenness) }
          : {}),
        ...(input.payload.careerPriority !== undefined
          ? { careerPriority: cleanOptionalString(input.payload.careerPriority) }
          : {}),
        ...(input.payload.familyInvolvementComfort !== undefined
          ? { familyInvolvementComfort: cleanOptionalString(input.payload.familyInvolvementComfort) }
          : {}),
        ...(input.payload.marriageTimeline !== undefined
          ? { marriageTimeline: cleanOptionalString(input.payload.marriageTimeline) }
          : {}),
        ...(input.payload.childrenPreference !== undefined
          ? { childrenPreference: cleanOptionalString(input.payload.childrenPreference) }
          : {}),
        ...(input.payload.religionSpirituality !== undefined
          ? { religionSpirituality: cleanOptionalString(input.payload.religionSpirituality) }
          : {}),
        ...(input.payload.shareSensitiveCompatibility !== undefined
          ? { shareSensitiveCompatibility: input.payload.shareSensitiveCompatibility }
          : {}),
        ...(input.payload.promptResponses !== undefined
          ? {
              promptResponses: input.payload.promptResponses.map((prompt) => ({
                promptId: prompt.promptId,
                answer: prompt.answer.trim(),
              })),
            }
          : {}),
      });

      await this.userRepository.touchLastActiveAt(
        input.userId,
        new Date(),
        tx,
      );

      const synced = await this.profileCompletionSyncService.recomputeAndPersist(
        input.userId,
        tx,
        new Date(),
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile.update",
          entityType: "UserProfile",
          entityId: synced.aggregate.profile?.id ?? null,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return synced;
    });

    return {
      profile: await mapMyProfileDto(
        result.aggregate,
        result.completion,
        this.objectStorageService,
      ),
    };
  }
}

function normalizeStringList(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  );
}

function cleanOptionalString(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDateOfBirthOrThrow(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppException(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      "dateOfBirth must be a valid ISO-8601 date",
    );
  }

  return parsed;
}

@Injectable()
export class UpdateLifestyleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly userLifestyleRepository: UserLifestyleRepository,
    private readonly profileAggregateRepository: ProfileAggregateRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: UpdateLifestyleDto;
    metadata: ProfileActionMetadata;
  }): Promise<PreferenceValueResponseDto<LifestyleDto>> {
    await this.userReaderService.getRequiredById(input.userId);

    const aggregate = await this.prisma.$transaction(async (tx) => {
      await this.userLifestyleRepository.upsert(tx, input.userId, {
        userId: input.userId,
        smoking: input.payload.smoking ?? null,
        drinking: input.payload.drinking ?? null,
        exercise: input.payload.exercise ?? null,
        diet: input.payload.diet ?? null,
        petPreference: input.payload.petPreference ?? null,
        sleepPattern: input.payload.sleepPattern ?? null,
        socialEnergy: input.payload.socialEnergy ?? null,
      });

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile.lifestyle.update",
          entityType: "UserLifestyle",
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      const snapshot = await this.profileAggregateRepository.findByUserId(
        input.userId,
        tx,
      );
      if (!snapshot) {
        throw new Error("User aggregate missing");
      }
      return snapshot;
    });

    return {
      value: mapLifestyleDto(aggregate),
    };
  }
}

@Injectable()
export class UpdateSchedulePreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly userSchedulePreferenceRepository: UserSchedulePreferenceRepository,
    private readonly profileAggregateRepository: ProfileAggregateRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: UpdateSchedulePreferenceDto;
    metadata: ProfileActionMetadata;
  }): Promise<PreferenceValueResponseDto<SchedulePreferenceDto>> {
    await this.userReaderService.getRequiredById(input.userId);

    const aggregate = await this.prisma.$transaction(async (tx) => {
      await this.userSchedulePreferenceRepository.upsert(tx, input.userId, {
        userId: input.userId,
        weekdayMask: input.payload.weekdayMask,
        timeBlockMask: input.payload.timeBlockMask,
        prefersWeekends: input.payload.prefersWeekends,
        remoteFriendly: input.payload.remoteFriendly,
        maxMeetupsPerWeek: input.payload.maxMeetupsPerWeek ?? null,
        preferredLeadTimeDays: input.payload.preferredLeadTimeDays ?? null,
        timezone: input.payload.timezone ?? null,
      });

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile.schedule-preference.update",
          entityType: "UserSchedulePreference",
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      const snapshot = await this.profileAggregateRepository.findByUserId(
        input.userId,
        tx,
      );
      if (!snapshot) {
        throw new Error("User aggregate missing");
      }
      return snapshot;
    });

    return {
      value: mapSchedulePreferenceDto(aggregate),
    };
  }
}

@Injectable()
export class UpdateDiscoveryPreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly userDiscoveryPreferenceRepository: UserDiscoveryPreferenceRepository,
    private readonly discoveryPreferencePolicyService: DiscoveryPreferencePolicyService,
    private readonly profileCompletionSyncService: ProfileCompletionSyncService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: UpdateDiscoveryPreferenceDto;
    metadata: ProfileActionMetadata;
  }): Promise<PreferenceValueResponseDto<DiscoveryPreferenceDto>> {
    await this.userReaderService.getRequiredById(input.userId);
    this.discoveryPreferencePolicyService.assertValid(input.payload);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.userDiscoveryPreferenceRepository.upsert(tx, input.userId, {
        userId: input.userId,
        minAge: input.payload.minAge,
        maxAge: input.payload.maxAge,
        maxDistanceKm: input.payload.maxDistanceKm,
        intentFilter: input.payload.intentFilter,
        preferredGenders: input.payload.preferredGenders,
        includeRecentlyActiveOnly: input.payload.includeRecentlyActiveOnly,
        preferSameCity: input.payload.preferSameCity,
      });

      const synced = await this.profileCompletionSyncService.recomputeAndPersist(
        input.userId,
        tx,
        new Date(),
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile.discovery-preference.update",
          entityType: "UserDiscoveryPreference",
          entityId: synced.aggregate.discoveryPreference?.id ?? null,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return synced.aggregate;
    });

    return {
      value: mapDiscoveryPreferenceDto(result),
    };
  }
}

@Injectable()
export class UpdateCommunicationPreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly userCommunicationPreferenceRepository: UserCommunicationPreferenceRepository,
    private readonly profileCompletionSyncService: ProfileCompletionSyncService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: UpdateCommunicationPreferenceDto;
    metadata: ProfileActionMetadata;
  }): Promise<PreferenceValueResponseDto<CommunicationPreferenceDto>> {
    await this.userReaderService.getRequiredById(input.userId);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.userCommunicationPreferenceRepository.upsert(tx, input.userId, {
        userId: input.userId,
        allowVoiceCalls: input.payload.allowVoiceCalls,
        allowVideoCalls: input.payload.allowVideoCalls,
        allowPushMatches: input.payload.allowPushMatches,
        allowPushMessages: input.payload.allowPushMessages,
        allowPushCalls: input.payload.allowPushCalls,
        allowReadReceipts: input.payload.allowReadReceipts,
      });

      const synced = await this.profileCompletionSyncService.recomputeAndPersist(
        input.userId,
        tx,
        new Date(),
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile.communication-preference.update",
          entityType: "UserCommunicationPreference",
          entityId: synced.aggregate.communicationPreference?.id ?? null,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return synced.aggregate;
    });

    return {
      value: mapCommunicationPreferenceDto(result),
    };
  }
}

async function mapAuthorizedPublicProfile(
  viewer: ProfileAggregateRecord,
  target: ProfileAggregateRecord,
  approvedPhotos: ProfileAggregateRecord["photos"],
  objectStorageService: ObjectStorageService,
): Promise<PublicProfileDto> {
  const profile = target.profile;
  if (!profile) {
    throw new AppException(404, ERROR_CODES.PROFILE_NOT_FOUND, "Profile not found");
  }

  const location = resolvePublicLocation(viewer, target);
  const viewerInterestIds = new Set(
    viewer.interests.map((interest) => interest.interestTagId),
  );
  const sharedInterests = target.interests
    .filter((interest) => viewerInterestIds.has(interest.interestTagId))
    .map((interest) => interest.interestTag.displayName);
  const viewerIntents = new Set(viewer.intents.map((intent) => intent.intent));
  const sharedIntentCount = target.intents.filter((intent) =>
    viewerIntents.has(intent.intent),
  ).length;
  const sharedDays =
    (viewer.schedulePreference?.weekdayMask ?? 0) &
    (target.schedulePreference?.weekdayMask ?? 0);
  const sharedTimeBlocks =
    (viewer.schedulePreference?.timeBlockMask ?? 0) &
    (target.schedulePreference?.timeBlockMask ?? 0);
  const scheduleOverlap =
    sharedDays !== 0 && sharedTimeBlocks !== 0
      ? "Your usual availability overlaps"
      : null;
  const compatibility: PublicProfileDto["compatibility"] = {
    score: Math.min(
      96,
      Math.max(
        55,
        60 +
          Math.min(24, sharedIntentCount * 12) +
          Math.min(18, sharedInterests.length * 6) +
          (scheduleOverlap ? 8 : 0) +
          (location.distanceBand === "LOCAL" || location.distanceBand === "NEARBY"
            ? 5
            : 0),
      ),
    ),
    reasons: [
      ...(sharedIntentCount > 0 ? ["Your relationship intentions align"] : []),
      ...(sharedInterests.length > 0
        ? [`You share ${sharedInterests.slice(0, 2).join(" and ")}`]
        : []),
      ...(scheduleOverlap ? [scheduleOverlap] : []),
    ].slice(0, 3),
    sharedInterests,
    scheduleOverlap,
  };
  const photos = await Promise.all(
    approvedPhotos.map(async (photo) => ({
      id: photo.id,
      url: await objectStorageService.createPresignedGetObject({
        disclosure: { viewerId: viewer.id, ownerId: target.id },
        bucket: photo.bucket,
        objectKey: photo.objectKey,
      }),
      width: photo.width ?? null,
      height: photo.height ?? null,
      isPrimary: photo.isPrimary,
      position: photo.position,
    })),
  );

  return {
    userId: target.id,
    displayName: profile.displayName ?? "Unknown",
    headline: profile.headline ?? null,
    bio: profile.bio ?? null,
    age: profile.hideAge
      ? null
      : profile.dateOfBirth
        ? calculatePublicAge(profile.dateOfBirth)
        : null,
    gender: profile.gender ?? null,
    pronouns: profile.pronouns ?? null,
    ...mapDatingProfileFields(profile, compatibility),
    location,
    intents: target.intents.map(
      (intent) => intent.intent as PublicProfileDto["intents"][number],
    ),
    interests: target.interests.map((interest) => ({
      id: interest.interestTag.id,
      slug: interest.interestTag.slug,
      displayName: interest.interestTag.displayName,
      category: interest.interestTag.category,
    })),
    lifestyle: {
      smoking: target.lifestyle?.smoking ?? null,
      drinking: target.lifestyle?.drinking ?? null,
      exercise: target.lifestyle?.exercise ?? null,
      diet: target.lifestyle?.diet ?? null,
      petPreference: target.lifestyle?.petPreference ?? null,
      sleepPattern: target.lifestyle?.sleepPattern ?? null,
      socialEnergy: target.lifestyle?.socialEnergy ?? null,
    },
    photos,
  };
}

function resolvePublicLocation(
  viewer: ProfileAggregateRecord,
  target: ProfileAggregateRecord,
): PublicProfileDto["location"] {
  const targetProfile = target.profile;
  const viewerProfile = viewer.profile;
  if (
    !targetProfile ||
    targetProfile.hideDistance ||
    !viewerProfile?.locationLat ||
    !viewerProfile.locationLng ||
    !targetProfile.locationLat ||
    !targetProfile.locationLng
  ) {
    return {
      city: targetProfile?.city ?? null,
      region: targetProfile?.region ?? null,
      countryCode: targetProfile?.countryCode ?? null,
      distanceKmRounded: 0,
      distanceBand: null,
    };
  }

  const distanceKm = haversineDistanceKm(
    Number(viewerProfile.locationLat.toString()),
    Number(viewerProfile.locationLng.toString()),
    Number(targetProfile.locationLat.toString()),
    Number(targetProfile.locationLng.toString()),
  );
  return {
    city: targetProfile.city ?? null,
    region: targetProfile.region ?? null,
    countryCode: targetProfile.countryCode ?? null,
    distanceKmRounded: roundDistanceKm(distanceKm),
    distanceBand: resolveDistanceBand(distanceKm),
  };
}

function calculatePublicAge(dateOfBirth: Date): number {
  const now = new Date();
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const month = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (
    month < 0 ||
    (month === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}
