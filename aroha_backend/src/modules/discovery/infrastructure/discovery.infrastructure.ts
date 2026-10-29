import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { RedisService } from "../../../integrations/redis/redis.service";
import type {
  InterestTag,
  Match,
  ProfilePhoto,
  TrustScore,
  User,
  UserDiscoveryPreference,
  UserIntent,
  UserInterest,
  UserLifestyle,
  UserProfile,
  UserSchedulePreference,
} from "../../../generated/prisma/client";

export interface ViewerDiscoveryContext extends User {
  profile: UserProfile | null;
  discoveryPreference: UserDiscoveryPreference | null;
  intents: Pick<UserIntent, "intent">[];
  interests: Pick<UserInterest, "interestTagId">[];
  lifestyle: UserLifestyle | null;
  schedulePreference: UserSchedulePreference | null;
  trustScore: TrustScore | null;
}

export interface CandidateDiscoveryRecord extends User {
  discoveryPreference: UserDiscoveryPreference | null;
  profile: UserProfile;
  photos: Pick<
    ProfilePhoto,
    | "id"
    | "objectKey"
    | "bucket"
    | "width"
    | "height"
    | "isPrimary"
    | "position"
  >[];
  intents: Pick<UserIntent, "intent">[];
  interests: (Pick<UserInterest, "interestTagId"> & {
    interestTag: Pick<InterestTag, "id" | "slug" | "displayName" | "category">;
  })[];
  lifestyle: UserLifestyle | null;
  schedulePreference: UserSchedulePreference | null;
  trustScore: TrustScore | null;
}

export interface DiscoveryExclusionState {
  blockedUserIds: Set<string>;
  matchedUserIds: Set<string>;
  activePassUserIds: Set<string>;
  activeLikeUserIds: Set<string>;
}

export interface DiscoverySnapshot {
  snapshotId: string;
  viewerId: string;
  preferenceHash: string;
  candidateIds: string[];
  createdAt: string;
  expiresAt: string;
}

@Injectable()
export class DiscoveryQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findViewerContext(
    userId: string,
  ): Promise<ViewerDiscoveryContext | null> {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        profile: true,
        discoveryPreference: true,
        intents: {
          where: {
            deletedAt: null,
          },
          select: {
            intent: true,
          },
        },
        interests: {
          where: {
            deletedAt: null,
            interestTag: { isActive: true },
          },
          select: {
            interestTagId: true,
          },
        },
        lifestyle: true,
        schedulePreference: true,
        trustScore: true,
      },
    });
  }

  async loadExclusionState(
    viewerId: string,
    now: Date,
  ): Promise<DiscoveryExclusionState> {
    const [blocks, matches, passes, likes] = await Promise.all([
      this.prisma.block.findMany({
        where: {
          deletedAt: null,
          OR: [{ blockerId: viewerId }, { blockedId: viewerId }],
        },
        select: {
          blockerId: true,
          blockedId: true,
        },
      }),
      this.prisma.match.findMany({
        where: {
          OR: [{ userLowId: viewerId }, { userHighId: viewerId }],
        },
        select: {
          userLowId: true,
          userHighId: true,
        },
      }),
      this.prisma.pass.findMany({
        where: {
          actorId: viewerId,
          deletedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        select: {
          targetId: true,
        },
      }),
      this.prisma.like.findMany({
        where: {
          actorId: viewerId,
          status: "ACTIVE",
        },
        select: {
          targetId: true,
        },
      }),
    ]);

    const blockedUserIds = new Set<string>();
    for (const block of blocks) {
      blockedUserIds.add(
        block.blockerId === viewerId ? block.blockedId : block.blockerId,
      );
    }

    const matchedUserIds = new Set<string>();
    for (const match of matches) {
      matchedUserIds.add(
        match.userLowId === viewerId ? match.userHighId : match.userLowId,
      );
    }

    return {
      blockedUserIds,
      matchedUserIds,
      activePassUserIds: new Set(passes.map((pass) => pass.targetId)),
      activeLikeUserIds: new Set(likes.map((like) => like.targetId)),
    };
  }

  async listCandidatePool(input: {
    viewerId: string;
    activeSince: Date | null;
  }): Promise<CandidateDiscoveryRecord[]> {
    return this.prisma.user.findMany({
      where: {
        id: {
          not: input.viewerId,
        },
        status: "ACTIVE",
        deletedAt: null,
        isShadowBanned: false,
        isDiscoveryFrozen: false,
        ...(input.activeSince
          ? {
              lastActiveAt: {
                gte: input.activeSince,
              },
            }
          : {}),
        profile: {
          is: {
            deletedAt: null,
            isHidden: false,
            isPaused: false,
            isIncognito: false,
            isComplete: true,
          },
        },
        photos: {
          some: {
            moderationStatus: "APPROVED",
            deletedAt: null,
            purpose: "PROFILE",
          },
        },
      },
      include: {
        profile: true,
        discoveryPreference: true,
        photos: {
          where: {
            moderationStatus: "APPROVED",
            deletedAt: null,
            purpose: "PROFILE",
          },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            objectKey: true,
            bucket: true,
            width: true,
            height: true,
            isPrimary: true,
            position: true,
          },
        },
        intents: {
          where: {
            deletedAt: null,
          },
          select: {
            intent: true,
          },
        },
        interests: {
          where: {
            deletedAt: null,
            interestTag: { isActive: true },
          },
          select: {
            interestTagId: true,
            interestTag: {
              select: {
                id: true,
                slug: true,
                displayName: true,
                category: true,
              },
            },
          },
        },
        lifestyle: true,
        schedulePreference: true,
        trustScore: true,
      },
    }) as Promise<CandidateDiscoveryRecord[]>;
  }

  async findCandidatesByIds(
    candidateIds: string[],
  ): Promise<CandidateDiscoveryRecord[]> {
    if (candidateIds.length === 0) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        id: {
          in: candidateIds,
        },
        status: "ACTIVE",
        deletedAt: null,
        isShadowBanned: false,
        isDiscoveryFrozen: false,
        profile: {
          is: {
            deletedAt: null,
            isHidden: false,
            isPaused: false,
            isIncognito: false,
            isComplete: true,
          },
        },
        photos: {
          some: {
            moderationStatus: "APPROVED",
            deletedAt: null,
            purpose: "PROFILE",
          },
        },
      },
      include: {
        profile: true,
        discoveryPreference: true,
        photos: {
          where: {
            moderationStatus: "APPROVED",
            deletedAt: null,
            purpose: "PROFILE",
          },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            objectKey: true,
            bucket: true,
            width: true,
            height: true,
            isPrimary: true,
            position: true,
          },
        },
        intents: {
          where: {
            deletedAt: null,
          },
          select: {
            intent: true,
          },
        },
        interests: {
          where: {
            deletedAt: null,
            interestTag: { isActive: true },
          },
          select: {
            interestTagId: true,
            interestTag: {
              select: {
                id: true,
                slug: true,
                displayName: true,
                category: true,
              },
            },
          },
        },
        lifestyle: true,
        schedulePreference: true,
        trustScore: true,
      },
    }) as Promise<CandidateDiscoveryRecord[]>;
  }
}

@Injectable()
export class DiscoverySnapshotRepository {
  private static readonly SNAPSHOT_KEY_PREFIX = "discovery:snapshot:";
  private static readonly SERVED_KEY_PREFIX = "discovery:served:";

  constructor(private readonly redis: RedisService) {}

  async get(
    viewerId: string,
    preferenceHash: string,
  ): Promise<DiscoverySnapshot | null> {
    const raw = await this.redis.get(
      this.snapshotKey(viewerId, preferenceHash),
    );
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as DiscoverySnapshot;
  }

  async set(snapshot: DiscoverySnapshot, ttlSeconds: number): Promise<void> {
    await this.redis.set(
      this.snapshotKey(snapshot.viewerId, snapshot.preferenceHash),
      JSON.stringify(snapshot),
      "EX",
      ttlSeconds,
    );
  }

  async invalidateViewer(viewerId: string): Promise<void> {
    const pattern = `${DiscoverySnapshotRepository.SNAPSHOT_KEY_PREFIX}${viewerId}:*`;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== "0");
  }

  async readRecentlyServedFlags(
    viewerId: string,
    candidateIds: string[],
  ): Promise<Set<string>> {
    if (candidateIds.length === 0) {
      return new Set();
    }

    const pipeline = this.redis.pipeline();
    const keys = candidateIds.map((candidateId) =>
      this.servedKey(viewerId, candidateId),
    );
    for (const key of keys) {
      pipeline.get(key);
    }
    const values = await pipeline.exec();
    const result = new Set<string>();

    values?.forEach((entry, index) => {
      const value = entry?.[1];
      const candidateId = candidateIds[index];
      if (value && candidateId) {
        result.add(candidateId);
      }
    });

    return result;
  }

  async markRecentlyServed(
    viewerId: string,
    candidateIds: string[],
  ): Promise<void> {
    if (candidateIds.length === 0) {
      return;
    }

    const pipeline = this.redis.pipeline();
    for (const candidateId of candidateIds) {
      pipeline.set(
        this.servedKey(viewerId, candidateId),
        "1",
        "EX",
        24 * 60 * 60,
      );
    }
    await pipeline.exec();
  }

  private snapshotKey(viewerId: string, preferenceHash: string): string {
    return `${DiscoverySnapshotRepository.SNAPSHOT_KEY_PREFIX}${viewerId}:${preferenceHash}`;
  }

  private servedKey(viewerId: string, candidateId: string): string {
    return `${DiscoverySnapshotRepository.SERVED_KEY_PREFIX}${viewerId}:${candidateId}`;
  }
}
