import { Injectable } from "@nestjs/common";
import {
  ProfileCompletionService,
  type ProfileCompletionStatus,
} from "../../../common/services/profile-completion.service";
import type { CurrentUserDto, ProfileCompletionStatusDto } from "../../auth/dto/auth.dto";
import type { GetMeResponseDto } from "../dto/users.dto";
import type { User } from "../../../generated/prisma/client";
import { UserEligibilityService, UserStatePolicyService } from "../domain/users.domain";
import { UserRepository, type UserMeRecord } from "../infrastructure/users.infrastructure";

@Injectable()
export class UserReaderService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userEligibilityService: UserEligibilityService,
  ) {}

  async getRequiredById(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    this.userEligibilityService.assertAccessible(user);
    return user;
  }
}

@Injectable()
export class GetMeService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userStatePolicyService: UserStatePolicyService,
    private readonly profileCompletionService: ProfileCompletionService,
  ) {}

  async execute(userId: string): Promise<GetMeResponseDto> {
    const user = await this.userRepository.findMeById(userId);
    this.userStatePolicyService.assertReadable(user);

    return {
      user: mapCurrentUser(user),
      profileCompletion: mapProfileCompletion(
        this.profileCompletionService.evaluate({
          accountIsActive: user.status === "ACTIVE" && user.deletedAt === null,
          profileHidden: user.profile?.isHidden ?? false,
          displayName: user.profile?.displayName ?? null,
          bio: user.profile?.bio ?? null,
          dateOfBirth: user.profile?.dateOfBirth ?? null,
          city: user.profile?.city ?? null,
          region: user.profile?.region ?? null,
          countryCode: user.profile?.countryCode ?? null,
          locationLat: user.profile?.locationLat ?? null,
          locationLng: user.profile?.locationLng ?? null,
          locationGeohash: user.profile?.locationGeohash ?? null,
          activeIntentCount: user.intents.length,
          approvedPhotoCount: user.photos.length,
          approvedPrimaryPhotoCount: user.photos.filter((photo) => photo.isPrimary)
            .length,
          discoveryPreference: user.discoveryPreference
            ? {
                minAge: user.discoveryPreference.minAge,
                maxAge: user.discoveryPreference.maxAge,
                maxDistanceKm: user.discoveryPreference.maxDistanceKm,
              }
            : null,
          communicationPreferenceExists: !!user.communicationPreference,
          completedAt: user.profile?.completedAt ?? null,
        }),
      ),
    };
  }
}

function mapCurrentUser(user: User): CurrentUserDto {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    isShadowBanned: user.isShadowBanned,
    isDiscoveryFrozen: user.isDiscoveryFrozen,
    isChatFrozen: user.isChatFrozen,
    isCallFrozen: user.isCallFrozen,
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function mapProfileCompletion(
  value: ProfileCompletionStatus,
): ProfileCompletionStatusDto {
  return {
    isComplete: value.isComplete,
    completedAt: value.completedAt?.toISOString() ?? null,
    missingCriteria: value.missingCriteria,
  };
}
