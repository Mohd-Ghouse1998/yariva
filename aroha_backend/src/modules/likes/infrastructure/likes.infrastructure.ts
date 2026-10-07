import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import { RedisService } from "../../../integrations/redis/redis.service";
import type {
  Like,
  Pass,
  User,
  UserProfile,
} from "../../../generated/prisma/client";

type LikeExecutor = PrismaService | PrismaTransactionalClient;

export type LikeTargetRecord = Pick<
  User,
  "id" | "status" | "deletedAt" | "isShadowBanned" | "isDiscoveryFrozen"
> & {
  profile: Pick<UserProfile, "isHidden" | "isComplete" | "deletedAt"> | null;
  photos: Array<{
    id: string;
  }>;
};

@Injectable()
export class LikeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByActorAndTarget(
    actorId: string,
    targetId: string,
    executor?: LikeExecutor,
  ): Promise<Like | null> {
    const db = executor ?? this.prisma;

    return db.like.findUnique({
      where: {
        actorId_targetId: {
          actorId,
          targetId,
        },
      },
    });
  }

  async create(
    executor: PrismaTransactionalClient,
    input: {
      actorId: string;
      targetId: string;
      introNote: string | null;
    },
  ): Promise<Like> {
    return executor.like.create({
      data: {
        actorId: input.actorId,
        targetId: input.targetId,
        introNote: input.introNote,
      },
    });
  }

  async reactivate(
    executor: PrismaTransactionalClient,
    likeId: string,
    introNote: string | null,
  ): Promise<Like> {
    return executor.like.update({
      where: {
        id: likeId,
      },
      data: {
        status: "ACTIVE",
        introNote,
        retractedAt: null,
      },
    });
  }

  async markMatched(
    executor: PrismaTransactionalClient,
    likeId: string,
    matchedAt: Date,
  ): Promise<Like> {
    return executor.like.update({
      where: {
        id: likeId,
      },
      data: {
        status: "MATCHED",
        matchedAt,
        retractedAt: null,
      },
    });
  }

  async retract(
    executor: PrismaTransactionalClient,
    likeId: string,
    retractedAt: Date,
  ): Promise<Like> {
    return executor.like.update({
      where: {
        id: likeId,
      },
      data: {
        status: "RETRACTED",
        retractedAt,
      },
    });
  }

  // Loads the slim "who liked me" view for the Likes tab. Filters out
  // retracted/already-matched and any actors that have an active block
  // either direction. Cursor is the createdAt of the last row.
  async findReceivedLikes(input: {
    targetUserId: string;
    cursor: Date | null;
    limit: number;
  }): Promise<
    Array<{
      id: string;
      actorId: string;
      introNote: string | null;
      createdAt: Date;
      actor: {
        profile: {
          displayName: string | null;
          headline: string | null;
          dateOfBirth: Date | null;
          city: string | null;
          region: string | null;
          isHidden: boolean;
          isComplete: boolean;
          deletedAt: Date | null;
        } | null;
        intents: Array<{ intent: string }>;
        photos: Array<{
          id: string;
          bucket: string;
          objectKey: string;
          isPrimary: boolean;
          position: number;
        }>;
        status: string;
        deletedAt: Date | null;
        isShadowBanned: boolean;
        isDiscoveryFrozen: boolean;
      };
    }>
  > {
    return this.prisma.like.findMany({
      where: {
        targetId: input.targetUserId,
        status: "ACTIVE",
        ...(input.cursor ? { createdAt: { lt: input.cursor } } : {}),
        actor: {
          deletedAt: null,
          status: "ACTIVE",
          isShadowBanned: false,
          // Hide actors who blocked the viewer and viewers blocked by actor.
          NOT: {
            OR: [
              {
                blocksInitiated: {
                  some: { blockedId: input.targetUserId, deletedAt: null },
                },
              },
              {
                blocksReceived: {
                  some: { blockerId: input.targetUserId, deletedAt: null },
                },
              },
            ],
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        actorId: true,
        introNote: true,
        createdAt: true,
        actor: {
          select: {
            status: true,
            deletedAt: true,
            isShadowBanned: true,
            isDiscoveryFrozen: true,
            profile: {
              select: {
                displayName: true,
                headline: true,
                dateOfBirth: true,
                city: true,
                region: true,
                isHidden: true,
                isComplete: true,
                deletedAt: true,
              },
            },
            intents: { select: { intent: true } },
            photos: {
              where: { deletedAt: null, purpose: "PROFILE", moderationStatus: "APPROVED" },
              orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
              take: 1,
              select: {
                id: true,
                bucket: true,
                objectKey: true,
                isPrimary: true,
                position: true,
              },
            },
          },
        },
      },
    });
  }
}

@Injectable()
export class PassRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByActorAndTarget(
    actorId: string,
    targetId: string,
    executor?: LikeExecutor,
  ): Promise<Pass | null> {
    const db = executor ?? this.prisma;

    return db.pass.findUnique({
      where: {
        actorId_targetId: {
          actorId,
          targetId,
        },
      },
    });
  }

  async upsertActive(
    executor: PrismaTransactionalClient,
    input: {
      actorId: string;
      targetId: string;
      expiresAt: Date;
    },
  ): Promise<Pass> {
    return executor.pass.upsert({
      where: {
        actorId_targetId: {
          actorId: input.actorId,
          targetId: input.targetId,
        },
      },
      create: {
        actorId: input.actorId,
        targetId: input.targetId,
        expiresAt: input.expiresAt,
      },
      update: {
        expiresAt: input.expiresAt,
        deletedAt: null,
      },
    });
  }

  async softDelete(
    executor: PrismaTransactionalClient,
    passId: string,
    deletedAt: Date,
  ): Promise<Pass> {
    return executor.pass.update({
      where: {
        id: passId,
      },
      data: {
        deletedAt,
      },
    });
  }
}

@Injectable()
export class LikeInteractionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLikeTarget(targetUserId: string): Promise<LikeTargetRecord | null> {
    return this.prisma.user.findFirst({
      where: {
        id: targetUserId,
      },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        isShadowBanned: true,
        isDiscoveryFrozen: true,
        profile: {
          select: {
            isHidden: true,
            isComplete: true,
            deletedAt: true,
          },
        },
        photos: {
          where: {
            deletedAt: null,
            purpose: "PROFILE",
            moderationStatus: "APPROVED",
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });
  }

  async hasActiveBlockBetween(
    actorId: string,
    targetId: string,
    executor?: LikeExecutor,
  ): Promise<boolean> {
    const db = executor ?? this.prisma;
    const count = await db.block.count({
      where: {
        deletedAt: null,
        OR: [
          {
            blockerId: actorId,
            blockedId: targetId,
          },
          {
            blockerId: targetId,
            blockedId: actorId,
          },
        ],
      },
    });

    return count > 0;
  }

  async hasHistoricalMatchBetween(
    actorId: string,
    targetId: string,
    executor?: LikeExecutor,
  ): Promise<boolean> {
    const [userLowId, userHighId] =
      actorId < targetId ? [actorId, targetId] : [targetId, actorId];
    const db = executor ?? this.prisma;

    const match = await db.match.findUnique({
      where: {
        userLowId_userHighId: {
          userLowId,
          userHighId,
        },
      },
      select: {
        id: true,
      },
    });

    return !!match;
  }
}

@Injectable()
export class LikeIdempotencyRepository {
  private static readonly TTL_SECONDS = 24 * 60 * 60;

  constructor(private readonly redis: RedisService) {}

  async get<TValue>(userId: string, key: string): Promise<TValue | null> {
    const raw = await this.redis.get(this.buildKey(userId, key));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as TValue;
  }

  async set<TValue>(userId: string, key: string, value: TValue): Promise<void> {
    await this.redis.set(
      this.buildKey(userId, key),
      JSON.stringify(value),
      "EX",
      LikeIdempotencyRepository.TTL_SECONDS,
    );
  }

  private buildKey(userId: string, key: string): string {
    return `idem:${userId}:like:${key}`;
  }
}
