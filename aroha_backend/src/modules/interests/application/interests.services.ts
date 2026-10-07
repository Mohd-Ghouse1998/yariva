import { Injectable } from "@nestjs/common";
import { AuditLogService } from "../../../common/services/audit-log.service";
import {
  ProfileCompletionService,
  resolvePersistedProfileCompletionState,
} from "../../../common/services/profile-completion.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { ProfileCompletionStatusDto } from "../../auth/dto/auth.dto";
import { UserReaderService } from "../../users/application/users.services";
import type {
  InterestTagDto,
  InterestTagPageDto,
  UpdateMyInterestsDto,
  UpdateMyInterestsResponseDto,
  UpdateMyIntentsDto,
  UpdateMyIntentsResponseDto,
} from "../dto/interests.dto";
import {
  IntentCompatibilityService,
  InterestValidationService,
} from "../domain/interests.domain";
import {
  InterestProfileCompletionRepository,
  InterestTagRepository,
  UserInterestRepository,
  UserIntentRepository,
} from "../infrastructure/interests.infrastructure";

export interface InterestActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class InterestCatalogService {
  constructor(private readonly interestTagRepository: InterestTagRepository) {}

  async list(input: {
    cursor?: string;
    limit?: number;
    search?: string;
  }): Promise<InterestTagPageDto> {
    const page = await this.interestTagRepository.list({
      cursor: input.cursor,
      limit: input.limit ?? 50,
      search: input.search?.trim() || undefined,
    });

    return {
      items: page.items.map(mapInterestTagDto),
      nextCursor: page.nextCursor,
    };
  }
}

@Injectable()
export class UserIntentReaderService {
  constructor(private readonly userIntentRepository: UserIntentRepository) {}

  async listActiveByUser(userId: string): Promise<string[]> {
    const intents = await this.userIntentRepository.listActiveByUser(userId);
    return intents.map((intent) => intent.intent);
  }
}

@Injectable()
export class ListInterestTagsService {
  constructor(private readonly interestCatalogService: InterestCatalogService) {}

  async execute(input: {
    cursor?: string;
    limit?: number;
    search?: string;
  }): Promise<InterestTagPageDto> {
    return this.interestCatalogService.list(input);
  }
}

@Injectable()
export class UpdateUserInterestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly interestValidationService: InterestValidationService,
    private readonly interestTagRepository: InterestTagRepository,
    private readonly userInterestRepository: UserInterestRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: UpdateMyInterestsDto;
    metadata: InterestActionMetadata;
  }): Promise<UpdateMyInterestsResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);

    const requestedTagIds = this.interestValidationService.normalizeInterestIds(
      input.payload.interestTagIds,
    );
    const tags = await this.interestTagRepository.findActiveByIds(requestedTagIds);
    this.interestValidationService.assertAllActiveTagsExist(requestedTagIds, tags);

    const interests = await this.prisma.$transaction(async (tx) => {
      const existing = await this.userInterestRepository.listAllByUser(
        input.userId,
        tx,
      );
      const desired = new Set(requestedTagIds);
      const now = new Date();

      for (const row of existing) {
        const wantsActive = desired.has(row.interestTagId);

        if (wantsActive && row.deletedAt) {
          await this.userInterestRepository.reactivate(tx, row.id);
        } else if (!wantsActive && !row.deletedAt) {
          await this.userInterestRepository.softDelete(tx, row.id, now);
        }
      }

      const existingByTagId = new Set(existing.map((row) => row.interestTagId));
      for (const interestTagId of requestedTagIds) {
        if (!existingByTagId.has(interestTagId)) {
          await this.userInterestRepository.create(tx, input.userId, interestTagId);
        }
      }

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "user.interests.update",
          entityType: "User",
          entityId: input.userId,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            interestTagIds: requestedTagIds,
          },
        },
        tx,
      );

      return this.userInterestRepository.listActiveByUser(input.userId, tx);
    });

    return {
      interests: interests.map((interest) => mapInterestTagDto(interest.interestTag)),
    };
  }
}

@Injectable()
export class UpdateUserIntentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly intentCompatibilityService: IntentCompatibilityService,
    private readonly userIntentRepository: UserIntentRepository,
    private readonly interestProfileCompletionRepository: InterestProfileCompletionRepository,
    private readonly profileCompletionService: ProfileCompletionService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    payload: UpdateMyIntentsDto;
    metadata: InterestActionMetadata;
  }): Promise<UpdateMyIntentsResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    const intents = this.intentCompatibilityService.normalizeIntents(
      input.payload.intents,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await this.userIntentRepository.listAllByUser(input.userId, tx);
      const desired = new Set(intents);
      const now = new Date();

      for (const row of existing) {
        const wantsActive = desired.has(row.intent as (typeof intents)[number]);

        if (wantsActive && row.deletedAt) {
          await this.userIntentRepository.reactivate(tx, row.id);
        } else if (!wantsActive && !row.deletedAt) {
          await this.userIntentRepository.softDelete(tx, row.id, now);
        }
      }

      const existingIntents = new Set(existing.map((row) => row.intent));
      for (const intent of intents) {
        if (!existingIntents.has(intent)) {
          await this.userIntentRepository.create(tx, input.userId, intent);
        }
      }

      const snapshot = await this.interestProfileCompletionRepository.findByUserId(
        input.userId,
        tx,
      );

      if (!snapshot?.profile) {
        throw new Error("Profile aggregate missing during intent update");
      }

      const evaluated = this.profileCompletionService.evaluate({
        accountIsActive: snapshot.status === "ACTIVE" && snapshot.deletedAt === null,
        profileHidden: snapshot.profile.isHidden,
        displayName: snapshot.profile.displayName,
        bio: snapshot.profile.bio,
        dateOfBirth: snapshot.profile.dateOfBirth,
        city: snapshot.profile.city,
        region: snapshot.profile.region,
        countryCode: snapshot.profile.countryCode,
        locationLat: snapshot.profile.locationLat,
        locationLng: snapshot.profile.locationLng,
        locationGeohash: snapshot.profile.locationGeohash,
        activeIntentCount: snapshot.intents.length,
        approvedPhotoCount: snapshot.photos.length,
        approvedPrimaryPhotoCount: snapshot.photos.filter((photo) => photo.isPrimary)
          .length,
        discoveryPreference: snapshot.discoveryPreference
          ? {
              minAge: snapshot.discoveryPreference.minAge,
              maxAge: snapshot.discoveryPreference.maxAge,
              maxDistanceKm: snapshot.discoveryPreference.maxDistanceKm,
            }
          : null,
        communicationPreferenceExists: !!snapshot.communicationPreference,
        completedAt: snapshot.profile.completedAt,
      });
      const resolved = resolvePersistedProfileCompletionState({
        previousIsComplete: snapshot.profile.isComplete,
        previousCompletedAt: snapshot.profile.completedAt,
        evaluated,
        now,
      });

      await this.interestProfileCompletionRepository.updateCompletionState(
        tx,
        input.userId,
        {
          isComplete: resolved.isComplete,
          completedAt: resolved.completedAt,
        },
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "user.intents.update",
          entityType: "User",
          entityId: input.userId,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            intents,
          },
        },
        tx,
      );

      return {
        intents,
        profileCompletion: {
          isComplete: resolved.isComplete,
          completedAt: resolved.completedAt?.toISOString() ?? null,
          missingCriteria: resolved.missingCriteria,
        } satisfies ProfileCompletionStatusDto,
      };
    });

    return result;
  }
}

function mapInterestTagDto(tag: {
  id: string;
  slug: string;
  displayName: string;
  category: string | null;
}): InterestTagDto {
  return {
    id: tag.id,
    slug: tag.slug,
    displayName: tag.displayName,
    category: tag.category,
  };
}
