import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import objectStorageConfig from "../../../config/object-storage.config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { randomBase64Url } from "../../../common/utils/crypto.util";
import { AppLogger } from "../../../common/logger/app-logger.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { BullmqProducer } from "../../../integrations/bullmq/bullmq.producer";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import { UserReaderService } from "../../users/application/users.services";
import {
  mapPrivatePhotoDto,
  mapProfileCompletion,
} from "./profiles.mappers";
import type {
  FinalizeProfilePhotoUploadDto,
  FinalizeProfilePhotoUploadResponseDto,
  InitiateProfilePhotoUploadDto,
  InitiateProfilePhotoUploadResponseDto,
  ProfilePhotoListResponseDto,
  ProfilePhotoResponseDto,
  ReorderProfilePhotosDto,
} from "../dto/profiles.dto";
import {
  PhotoEligibilityService,
  PhotoOwnershipPolicy,
} from "../domain/profiles.domain";
import {
  ProfilePhotoRepository,
  ProfilePhotoUploadStateStore,
} from "../infrastructure/profiles.infrastructure";
import { ProfileCompletionSyncService, type ProfileActionMetadata } from "./profiles.services";

const PROFILE_PHOTO_UPLOAD_TTL_SECONDS = 15 * 60;
const PROFILE_PHOTO_MAX_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class InitiatePhotoUploadService {
  constructor(
    private readonly userReaderService: UserReaderService,
    private readonly photoEligibilityService: PhotoEligibilityService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly profilePhotoUploadStateStore: ProfilePhotoUploadStateStore,
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
  ) {}

  async execute(input: {
    userId: string;
    payload: InitiateProfilePhotoUploadDto;
  }): Promise<InitiateProfilePhotoUploadResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.photoEligibilityService.assertUploadRequestAllowed(input.payload);

    const uploadToken = randomBase64Url(32);
    const objectKey = buildProfilePhotoObjectKey(
      input.userId,
      input.payload.fileName,
      input.payload.mimeType,
      input.payload.purpose ?? "PROFILE",
    );
    const instruction = await this.objectStorageService.createPresignedPutObject(
      {
        bucket: this.storageConfig.bucketProfilePhotos,
        objectKey,
        mimeType: input.payload.mimeType,
        uploadToken,
        userId: input.userId,
        sha256: input.payload.sha256 ?? null,
        expiresInSeconds: PROFILE_PHOTO_UPLOAD_TTL_SECONDS,
      },
    );

    await this.profilePhotoUploadStateStore.save(
      {
        userId: input.userId,
        uploadToken,
        bucket: this.storageConfig.bucketProfilePhotos,
        objectKey,
        fileName: input.payload.fileName,
        mimeType: input.payload.mimeType,
        sizeBytes: input.payload.sizeBytes,
        sha256: input.payload.sha256 ?? null,
        purpose: input.payload.purpose ?? "PROFILE",
        expiresAt: instruction.expiresAt.toISOString(),
      },
      PROFILE_PHOTO_UPLOAD_TTL_SECONDS,
    );

    return {
      uploadToken,
      objectKey,
      bucket: this.storageConfig.bucketProfilePhotos,
      method: "PUT",
      uploadUrl: instruction.uploadUrl,
      headers: instruction.headers,
      expiresAt: instruction.expiresAt.toISOString(),
      maxSizeBytes: PROFILE_PHOTO_MAX_SIZE_BYTES,
    };
  }
}

@Injectable()
export class FinalizePhotoUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly photoEligibilityService: PhotoEligibilityService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly profilePhotoRepository: ProfilePhotoRepository,
    private readonly profilePhotoUploadStateStore: ProfilePhotoUploadStateStore,
    private readonly profileCompletionSyncService: ProfileCompletionSyncService,
    private readonly bullmqProducer: BullmqProducer,
    private readonly auditLogService: AuditLogService,
    private readonly logger: AppLogger,
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
  ) {}

  async execute(input: {
    userId: string;
    payload: FinalizeProfilePhotoUploadDto;
    metadata: ProfileActionMetadata;
  }): Promise<FinalizeProfilePhotoUploadResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.photoEligibilityService.assertFinalizeRequestAllowed(input.payload);

    const uploadState = await this.profilePhotoUploadStateStore.get(
      input.payload.uploadToken,
    );

    if (!uploadState) {
      throw new AppException(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        "Profile photo upload is invalid or expired",
      );
    }

    if (input.payload.bucket !== this.storageConfig.bucketProfilePhotos) {
      throw new AppException(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        "Profile photo bucket is invalid",
      );
    }

    assertUploadStateMatches(uploadState, input.userId, input.payload);

    const head = await this.objectStorageService.headObject({
      bucket: input.payload.bucket,
      objectKey: input.payload.objectKey,
    });

    assertHeadedObjectMatches(head, uploadState, input.payload);

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await this.profilePhotoRepository.findByUserAndObjectKey(
        input.userId,
        input.payload.objectKey,
        tx,
      );

      let photo;
      if (existing) {
        photo = await this.profilePhotoRepository.updateMetadata(tx, existing.id, {
          mimeType: input.payload.mimeType,
          sizeBytes: input.payload.sizeBytes,
          width: input.payload.width,
          height: input.payload.height,
          sha256: input.payload.sha256 ?? null,
          isPrimary: false,
          purpose: uploadState.purpose ?? "PROFILE",
          moderationStatus: "PENDING",
          moderationReason: null,
          reviewedAt: null,
          approvedAt: null,
          rejectedAt: null,
        });
      } else {
        const purpose = uploadState.purpose ?? "PROFILE";
        const currentCount =
          purpose === "PROFILE"
            ? await this.profilePhotoRepository.countByUser(input.userId, tx)
            : 0;
        const insertionPosition =
          purpose === "PROFILE" ? Math.min(input.payload.position, currentCount) : 0;
        if (purpose === "PROFILE") {
          await this.profilePhotoRepository.shiftPositionsForInsert(
            tx,
            input.userId,
            insertionPosition,
          );
        }

        photo = await this.profilePhotoRepository.create(tx, {
          userId: input.userId,
          objectKey: input.payload.objectKey,
          bucket: input.payload.bucket,
          mimeType: input.payload.mimeType,
          sizeBytes: input.payload.sizeBytes,
          width: input.payload.width,
          height: input.payload.height,
          sha256: input.payload.sha256 ?? null,
          position: insertionPosition,
          isPrimary: false,
          purpose,
        });
      }

      const synced = await this.profileCompletionSyncService.recomputeAndPersist(
        input.userId,
        tx,
        now,
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile-photo.finalize",
          entityType: "ProfilePhoto",
          entityId: photo.id,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            objectKey: photo.objectKey,
            purpose: photo.purpose,
          },
        },
        tx,
      );

      return {
        photo,
        completion: synced.completion,
      };
    });

    await this.profilePhotoUploadStateStore.delete(input.payload.uploadToken);
    await this.enqueuePhotoModeration(result.photo.id, input.userId, result.photo.objectKey, result.photo.mimeType);

    return {
      photo: await mapPrivatePhotoDto(result.photo, this.objectStorageService),
      profileCompletion: mapProfileCompletion(result.completion),
    };
  }

  private async enqueuePhotoModeration(
    photoId: string,
    userId: string,
    objectKey: string,
    mimeType: string,
  ): Promise<void> {
    try {
      await this.bullmqProducer.enqueue(
        "photo.moderation",
        {
          photoId,
          userId,
          objectKey,
          mimeType,
        },
        {
          jobId: `photo.moderation:${photoId}`,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue photo moderation job for photo ${photoId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

@Injectable()
export class GetOwnedPhotoService {
  constructor(
    private readonly userReaderService: UserReaderService,
    private readonly profilePhotoRepository: ProfilePhotoRepository,
    private readonly photoOwnershipPolicy: PhotoOwnershipPolicy,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async execute(input: {
    userId: string;
    photoId: string;
  }): Promise<ProfilePhotoResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    const photo = await this.profilePhotoRepository.findById(input.photoId);
    this.photoOwnershipPolicy.assertOwned(photo, input.userId);
    return {
      photo: await mapPrivatePhotoDto(photo, this.objectStorageService),
    };
  }
}

@Injectable()
export class ReorderProfilePhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly profilePhotoRepository: ProfilePhotoRepository,
    private readonly photoEligibilityService: PhotoEligibilityService,
    private readonly auditLogService: AuditLogService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async execute(input: {
    userId: string;
    payload: ReorderProfilePhotosDto;
    metadata: ProfileActionMetadata;
  }): Promise<ProfilePhotoListResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);

    const currentPhotos = await this.profilePhotoRepository.listByUser(input.userId);
    this.photoEligibilityService.assertOrderingMatches(
      currentPhotos,
      input.payload,
    );

    const photos = await this.prisma.$transaction(async (tx) => {
      for (const [index, photoId] of input.payload.orderedPhotoIds.entries()) {
        await this.profilePhotoRepository.reorder(tx, photoId, index);
      }

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile-photo.reorder",
          entityType: "User",
          entityId: input.userId,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return this.profilePhotoRepository.listByUser(input.userId, tx);
    });

    return {
      photos: await Promise.all(
        photos.map((photo) =>
          mapPrivatePhotoDto(photo, this.objectStorageService),
        ),
      ),
    };
  }
}

@Injectable()
export class SetPrimaryPhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly profilePhotoRepository: ProfilePhotoRepository,
    private readonly photoOwnershipPolicy: PhotoOwnershipPolicy,
    private readonly photoEligibilityService: PhotoEligibilityService,
    private readonly profileCompletionSyncService: ProfileCompletionSyncService,
    private readonly auditLogService: AuditLogService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async execute(input: {
    userId: string;
    photoId: string;
    metadata: ProfileActionMetadata;
  }): Promise<ProfilePhotoResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);

    const photo = await this.profilePhotoRepository.findById(input.photoId);
    this.photoOwnershipPolicy.assertOwned(photo, input.userId);
    this.photoEligibilityService.assertCanBePrimary(photo);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.profilePhotoRepository.clearPrimary(tx, input.userId);
      const updated = await this.profilePhotoRepository.setPrimary(tx, input.photoId);
      await this.profileCompletionSyncService.recomputeAndPersist(
        input.userId,
        tx,
        new Date(),
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile-photo.primary.set",
          entityType: "ProfilePhoto",
          entityId: updated.id,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return updated;
    });

    return {
      photo: await mapPrivatePhotoDto(result, this.objectStorageService),
    };
  }
}

@Injectable()
export class DeleteProfilePhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly profilePhotoRepository: ProfilePhotoRepository,
    private readonly photoOwnershipPolicy: PhotoOwnershipPolicy,
    private readonly profileCompletionSyncService: ProfileCompletionSyncService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    photoId: string;
    metadata: ProfileActionMetadata;
  }): Promise<void> {
    await this.userReaderService.getRequiredById(input.userId);

    const photo = await this.profilePhotoRepository.findById(input.photoId);
    this.photoOwnershipPolicy.assertOwned(photo, input.userId);

    await this.prisma.$transaction(async (tx) => {
      const deletedAt = new Date();
      await this.profilePhotoRepository.softDelete(tx, photo.id, deletedAt);
      if (photo.purpose === "PROFILE") {
        await this.profilePhotoRepository.shiftPositionsAfterRemoval(
          tx,
          input.userId,
          photo.position,
        );
      }

      if (photo.isPrimary) {
        const next = await this.profilePhotoRepository.findNextPrimaryCandidate(
          input.userId,
          tx,
        );
        if (next) {
          await this.profilePhotoRepository.setPrimary(tx, next.id);
        }
      }

      if (photo.purpose === "PROFILE") {
        await this.profileCompletionSyncService.recomputeAndPersist(
          input.userId,
          tx,
          deletedAt,
        );
      }

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "profile-photo.delete",
          entityType: "ProfilePhoto",
          entityId: photo.id,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: { purpose: photo.purpose },
        },
        tx,
      );
    });
  }
}

function buildProfilePhotoObjectKey(
  userId: string,
  fileName: string,
  mimeType: string,
  purpose: "PROFILE" | "SCENE",
): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const extension = resolvePhotoExtension(fileName, mimeType);

  return `${userId}/${purpose.toLowerCase()}/${year}/${month}/${randomUUID()}${extension}`;
}

function resolvePhotoExtension(fileName: string, mimeType: string): string {
  const extension = extname(fileName.trim()).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg" || extension === ".png" || extension === ".webp") {
    return extension;
  }

  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
}

function assertUploadStateMatches(
  uploadState: {
    userId: string;
    bucket: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string | null;
  },
  userId: string,
  payload: FinalizeProfilePhotoUploadDto,
): void {
  if (
    uploadState.userId !== userId ||
    uploadState.bucket !== payload.bucket ||
    uploadState.objectKey !== payload.objectKey ||
    uploadState.mimeType !== payload.mimeType ||
    uploadState.sizeBytes !== payload.sizeBytes ||
    (uploadState.sha256 ?? null) !== (payload.sha256 ?? null)
  ) {
    throw new AppException(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      "Profile photo upload does not match the initiated upload",
    );
  }
}

function assertHeadedObjectMatches(
  head: {
    sizeBytes: number | null;
    mimeType: string | null;
    metadata: Record<string, string>;
  },
  uploadState: {
    userId: string;
    uploadToken: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string | null;
  },
  payload: FinalizeProfilePhotoUploadDto,
): void {
  if (head.sizeBytes !== payload.sizeBytes || head.mimeType !== payload.mimeType) {
    throw new AppException(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      "Uploaded object metadata does not match the expected file",
    );
  }

  if (
    head.metadata["aroha-user-id"] !== uploadState.userId ||
    head.metadata["aroha-upload-token"] !== uploadState.uploadToken
  ) {
    throw new AppException(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      "Uploaded object ownership metadata is invalid",
    );
  }

  if ((payload.sha256 ?? null) !== (head.metadata["aroha-sha256"] ?? null)) {
    throw new AppException(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      "Uploaded object checksum does not match",
    );
  }
}
