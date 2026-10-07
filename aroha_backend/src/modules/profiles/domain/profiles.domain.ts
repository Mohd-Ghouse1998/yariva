import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { encodeGeohash } from "../../../common/utils/geohash.util";
import type {
  ProfilePhoto,
  UserProfile,
} from "../../../generated/prisma/client";
import type {
  FinalizeProfilePhotoUploadDto,
  InitiateProfilePhotoUploadDto,
  ReorderProfilePhotosDto,
  UpdateDiscoveryPreferenceDto,
} from "../dto/profiles.dto";

const MAX_PROFILE_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ProfileVisibilityPolicyService {
  assertProfileExists<TProfile extends UserProfile>(
    profile: TProfile | null,
  ): asserts profile is TProfile {
    if (!profile || profile.deletedAt) {
      throw new AppException(
        404,
        ERROR_CODES.PROFILE_NOT_FOUND,
        "Profile not found",
      );
    }
  }
}

@Injectable()
export class PhotoEligibilityService {
  assertUploadRequestAllowed(input: InitiateProfilePhotoUploadDto): void {
    if (input.sizeBytes > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      throw new AppException(
        400,
        ERROR_CODES.PROFILE_PHOTO_TOO_LARGE,
        "Profile photo exceeds maximum size",
      );
    }
  }

  assertFinalizeRequestAllowed(input: FinalizeProfilePhotoUploadDto): void {
    if (input.sizeBytes > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      throw new AppException(
        400,
        ERROR_CODES.PROFILE_PHOTO_TOO_LARGE,
        "Profile photo exceeds maximum size",
      );
    }
  }

  assertOrderingMatches(
    currentPhotos: ProfilePhoto[],
    input: ReorderProfilePhotosDto,
  ): void {
    const currentIds = currentPhotos.map((photo) => photo.id).sort();
    const orderedIds = [...input.orderedPhotoIds].sort();

    if (
      currentIds.length !== orderedIds.length ||
      currentIds.some((id, index) => id !== orderedIds[index])
    ) {
      throw new AppException(
        400,
        ERROR_CODES.PROFILE_PHOTO_ORDER_INVALID,
        "Photo order must contain exactly the current active photos",
      );
    }
  }

  assertCanBePrimary(
    photo: Pick<ProfilePhoto, "moderationStatus" | "purpose">,
  ): void {
    if (photo.purpose !== "PROFILE") {
      throw new AppException(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        "Only profile photos can be selected as primary",
      );
    }

    if (photo.moderationStatus === "PENDING") {
      throw new AppException(
        409,
        ERROR_CODES.PROFILE_PHOTO_PENDING_MODERATION,
        "Profile photo is still pending moderation",
      );
    }

    if (photo.moderationStatus === "REJECTED") {
      throw new AppException(
        409,
        ERROR_CODES.PROFILE_PHOTO_REJECTED,
        "Profile photo was rejected by moderation",
      );
    }
  }
}

@Injectable()
export class LocationPrivacyService {
  normalizeCountryCode(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    return value.trim().toUpperCase();
  }

  normalizeLocation(
    value: { lat: number; lng: number } | null | undefined,
  ): { lat: number; lng: number; geohash: string } | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (value.lat < -90 || value.lat > 90 || value.lng < -180 || value.lng > 180) {
      throw new AppException(
        400,
        ERROR_CODES.PROFILE_LOCATION_REQUIRED,
        "Location coordinates are invalid",
      );
    }

    return {
      lat: value.lat,
      lng: value.lng,
      geohash: encodeGeohash(value.lat, value.lng),
    };
  }

  assertAdult(dateOfBirth: Date | null | undefined): void {
    if (!dateOfBirth) {
      return;
    }

    const today = new Date();
    let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
    const monthDifference = today.getUTCMonth() - dateOfBirth.getUTCMonth();
    const dayDifference = today.getUTCDate() - dateOfBirth.getUTCDate();

    if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
      age -= 1;
    }

    if (age < 18) {
      throw new AppException(
        400,
        ERROR_CODES.PROFILE_AGE_RESTRICTED,
        "User must be at least 18",
      );
    }
  }
}

@Injectable()
export class DiscoveryPreferencePolicyService {
  assertValid(input: UpdateDiscoveryPreferenceDto): void {
    if (input.maxAge < input.minAge) {
      throw new AppException(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        "Discovery preference age range is invalid",
      );
    }
  }
}

@Injectable()
export class ProfileOwnershipPolicy {
  assertOwned(ownerUserId: string, actorUserId: string): void {
    if (ownerUserId !== actorUserId) {
      throw new AppException(
        403,
        ERROR_CODES.FORBIDDEN,
        "Forbidden",
      );
    }
  }
}

@Injectable()
export class PhotoOwnershipPolicy {
  assertOwned<TPhoto extends Pick<ProfilePhoto, "userId" | "deletedAt">>(
    photo: TPhoto | null,
    actorUserId: string,
  ): asserts photo is TPhoto {
    if (!photo || photo.deletedAt) {
      throw new AppException(
        404,
        ERROR_CODES.PROFILE_PHOTO_NOT_FOUND,
        "Profile photo not found",
      );
    }

    if (photo.userId !== actorUserId) {
      throw new AppException(
        403,
        ERROR_CODES.PROFILE_PHOTO_NOT_OWNED,
        "Profile photo belongs to another user",
      );
    }
  }
}
