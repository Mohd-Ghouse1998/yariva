import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../integrations/redis/redis.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  InterestTag,
  PhotoPurpose,
  ProfilePhoto,
  Prisma,
  User,
  UserCommunicationPreference,
  UserDiscoveryPreference,
  UserIntent,
  UserInterest,
  UserLifestyle,
  UserProfile,
  UserSchedulePreference,
} from "../../../generated/prisma/client";

type ProfileExecutor = PrismaService | PrismaTransactionalClient;

export interface ProfileAggregateRecord extends User {
  profile: UserProfile | null;
  photos: ProfilePhoto[];
  intents: Pick<UserIntent, "intent">[];
  interests: (UserInterest & {
    interestTag: InterestTag;
  })[];
  lifestyle: UserLifestyle | null;
  schedulePreference: UserSchedulePreference | null;
  discoveryPreference: UserDiscoveryPreference | null;
  communicationPreference: UserCommunicationPreference | null;
}

export interface ProfilePhotoUploadIntent {
  userId: string;
  uploadToken: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string | null;
  purpose: PhotoPurpose;
  expiresAt: string;
}

@Injectable()
export class ProfileAggregateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(
    userId: string,
    executor?: ProfileExecutor,
  ): Promise<ProfileAggregateRecord | null> {
    const db = executor ?? this.prisma;

    return db.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        profile: true,
        photos: {
          where: {
            deletedAt: null,
            purpose: "PROFILE",
          },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        },
        intents: {
          where: {
            deletedAt: null,
          },
          select: {
            intent: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        interests: {
          where: {
            deletedAt: null,
          },
          include: {
            interestTag: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        lifestyle: true,
        schedulePreference: true,
        discoveryPreference: true,
        communicationPreference: true,
      },
    });
  }
}

@Injectable()
export class UserProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(
    executor: PrismaTransactionalClient,
    userId: string,
    data: Prisma.UserProfileUpdateInput,
  ): Promise<UserProfile> {
    return executor.userProfile.update({
      where: {
        userId,
      },
      data,
    });
  }

  async updateCompletionState(
    executor: PrismaTransactionalClient,
    userId: string,
    input: {
      isComplete: boolean;
      completedAt: Date | null;
    },
  ): Promise<void> {
    await executor.userProfile.update({
      where: {
        userId,
      },
      data: {
        isComplete: input.isComplete,
        completedAt: input.completedAt,
      },
    });
  }
}

@Injectable()
export class ProfilePhotoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(photoId: string): Promise<ProfilePhoto | null> {
    return this.prisma.profilePhoto.findFirst({
      where: {
        id: photoId,
        deletedAt: null,
      },
    });
  }

  async findByUserAndObjectKey(
    userId: string,
    objectKey: string,
    executor?: ProfileExecutor,
  ): Promise<ProfilePhoto | null> {
    const db = executor ?? this.prisma;

    return db.profilePhoto.findFirst({
      where: {
        userId,
        objectKey,
        deletedAt: null,
      },
    });
  }

  async listByUser(
    userId: string,
    executor?: ProfileExecutor,
  ): Promise<ProfilePhoto[]> {
    const db = executor ?? this.prisma;

    return db.profilePhoto.findMany({
      where: {
        userId,
        deletedAt: null,
        purpose: "PROFILE",
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }

  async countByUser(
    userId: string,
    executor?: ProfileExecutor,
  ): Promise<number> {
    const db = executor ?? this.prisma;

    return db.profilePhoto.count({
      where: {
        userId,
        deletedAt: null,
        purpose: "PROFILE",
      },
    });
  }

  async shiftPositionsForInsert(
    executor: PrismaTransactionalClient,
    userId: string,
    fromPosition: number,
  ): Promise<void> {
    await executor.profilePhoto.updateMany({
      where: {
        userId,
        deletedAt: null,
        purpose: "PROFILE",
        position: {
          gte: fromPosition,
        },
      },
      data: {
        position: {
          increment: 1,
        },
      },
    });
  }

  async shiftPositionsAfterRemoval(
    executor: PrismaTransactionalClient,
    userId: string,
    removedPosition: number,
  ): Promise<void> {
    await executor.profilePhoto.updateMany({
      where: {
        userId,
        deletedAt: null,
        purpose: "PROFILE",
        position: {
          gt: removedPosition,
        },
      },
      data: {
        position: {
          decrement: 1,
        },
      },
    });
  }

  async create(
    executor: PrismaTransactionalClient,
    input: {
      userId: string;
      objectKey: string;
      bucket: string;
      mimeType: string;
      sizeBytes: number;
      width: number;
      height: number;
      sha256: string | null;
      position: number;
      isPrimary: boolean;
      purpose: PhotoPurpose;
    },
  ): Promise<ProfilePhoto> {
    return executor.profilePhoto.create({
      data: {
        userId: input.userId,
        objectKey: input.objectKey,
        bucket: input.bucket,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        width: input.width,
        height: input.height,
        sha256: input.sha256,
        position: input.position,
        isPrimary: input.isPrimary,
        purpose: input.purpose,
        moderationStatus: "PENDING",
        moderationReason: null,
        reviewedAt: null,
        approvedAt: null,
        rejectedAt: null,
      },
    });
  }

  async updateMetadata(
    executor: PrismaTransactionalClient,
    photoId: string,
    data: Prisma.ProfilePhotoUpdateInput,
  ): Promise<ProfilePhoto> {
    return executor.profilePhoto.update({
      where: {
        id: photoId,
      },
      data,
    });
  }

  async clearPrimary(
    executor: PrismaTransactionalClient,
    userId: string,
  ): Promise<void> {
    await executor.profilePhoto.updateMany({
      where: {
        userId,
        deletedAt: null,
        purpose: "PROFILE",
        isPrimary: true,
      },
      data: {
        isPrimary: false,
      },
    });
  }

  async setPrimary(
    executor: PrismaTransactionalClient,
    photoId: string,
  ): Promise<ProfilePhoto> {
    return executor.profilePhoto.update({
      where: {
        id: photoId,
      },
      data: {
        isPrimary: true,
      },
    });
  }

  async reorder(
    executor: PrismaTransactionalClient,
    photoId: string,
    position: number,
  ): Promise<void> {
    await executor.profilePhoto.update({
      where: {
        id: photoId,
      },
      data: {
        position,
      },
    });
  }

  async softDelete(
    executor: PrismaTransactionalClient,
    photoId: string,
    deletedAt: Date,
  ): Promise<void> {
    await executor.profilePhoto.update({
      where: {
        id: photoId,
      },
      data: {
        deletedAt,
        isPrimary: false,
      },
    });
  }

  async findNextPrimaryCandidate(
    userId: string,
    executor: PrismaTransactionalClient,
  ): Promise<ProfilePhoto | null> {
    return executor.profilePhoto.findFirst({
      where: {
        userId,
        deletedAt: null,
        purpose: "PROFILE",
        moderationStatus: "APPROVED",
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }
}

@Injectable()
export class UserLifestyleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    executor: PrismaTransactionalClient,
    userId: string,
    data: Prisma.UserLifestyleUncheckedCreateInput,
  ): Promise<UserLifestyle> {
    return executor.userLifestyle.upsert({
      where: {
        userId,
      },
      create: data,
      update: data,
    });
  }
}

@Injectable()
export class UserSchedulePreferenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    executor: PrismaTransactionalClient,
    userId: string,
    data: Prisma.UserSchedulePreferenceUncheckedCreateInput,
  ): Promise<UserSchedulePreference> {
    return executor.userSchedulePreference.upsert({
      where: {
        userId,
      },
      create: data,
      update: data,
    });
  }
}

@Injectable()
export class UserDiscoveryPreferenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    executor: PrismaTransactionalClient,
    userId: string,
    data: Prisma.UserDiscoveryPreferenceUncheckedCreateInput,
  ): Promise<UserDiscoveryPreference> {
    return executor.userDiscoveryPreference.upsert({
      where: {
        userId,
      },
      create: data,
      update: data,
    });
  }
}

@Injectable()
export class UserCommunicationPreferenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    executor: PrismaTransactionalClient,
    userId: string,
    data: Prisma.UserCommunicationPreferenceUncheckedCreateInput,
  ): Promise<UserCommunicationPreference> {
    return executor.userCommunicationPreference.upsert({
      where: {
        userId,
      },
      create: data,
      update: data,
    });
  }
}

@Injectable()
export class ProfilePhotoUploadStateStore {
  private static readonly KEY_PREFIX = "profile-photo-upload:";

  constructor(private readonly redis: RedisService) {}

  async save(input: ProfilePhotoUploadIntent, ttlSeconds: number): Promise<void> {
    await this.redis.set(
      `${ProfilePhotoUploadStateStore.KEY_PREFIX}${input.uploadToken}`,
      JSON.stringify(input),
      "EX",
      ttlSeconds,
    );
  }

  async get(uploadToken: string): Promise<ProfilePhotoUploadIntent | null> {
    const raw = await this.redis.get(
      `${ProfilePhotoUploadStateStore.KEY_PREFIX}${uploadToken}`,
    );

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as ProfilePhotoUploadIntent;
  }

  async delete(uploadToken: string): Promise<void> {
    await this.redis.del(
      `${ProfilePhotoUploadStateStore.KEY_PREFIX}${uploadToken}`,
    );
  }
}
