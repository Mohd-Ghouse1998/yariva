import { Injectable } from "@nestjs/common";
import { decodeDateIdCursor, encodeDateIdCursor } from "../../../common/utils/cursor.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  InterestTag,
  ProfilePhoto,
  User,
  UserCommunicationPreference,
  UserDiscoveryPreference,
  UserIntent,
  UserInterest,
  UserProfile,
} from "../../../generated/prisma/client";

type InterestsExecutor = PrismaService | PrismaTransactionalClient;

export interface InterestCompletionRecord extends User {
  profile: UserProfile | null;
  discoveryPreference: UserDiscoveryPreference | null;
  communicationPreference: UserCommunicationPreference | null;
  intents: Pick<UserIntent, "intent">[];
  photos: Pick<ProfilePhoto, "id" | "isPrimary" | "moderationStatus">[];
}

@Injectable()
export class InterestTagRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: {
    cursor?: string;
    limit: number;
    search?: string;
  }): Promise<{
    items: InterestTag[];
    nextCursor: string | null;
  }> {
    const cursor = input.cursor ? decodeDateIdCursor(input.cursor) : null;
    const items = await this.prisma.interestTag.findMany({
      where: {
        isActive: true,
        ...(input.search
          ? {
              OR: [
                {
                  slug: {
                    contains: input.search,
                    mode: "insensitive",
                  },
                },
                {
                  displayName: {
                    contains: input.search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
        ...(cursor
          ? {
              OR: [
                {
                  createdAt: {
                    lt: new Date(cursor.createdAt),
                  },
                },
                {
                  createdAt: new Date(cursor.createdAt),
                  id: {
                    lt: cursor.id,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });

    const hasMore = items.length > input.limit;
    const pageItems = hasMore ? items.slice(0, input.limit) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems,
      nextCursor:
        hasMore && lastItem
          ? encodeDateIdCursor({
              createdAt: lastItem.createdAt.toISOString(),
              id: lastItem.id,
            })
          : null,
    };
  }

  async findActiveByIds(
    interestTagIds: string[],
    executor?: InterestsExecutor,
  ): Promise<InterestTag[]> {
    const db = executor ?? this.prisma;

    if (interestTagIds.length === 0) {
      return [];
    }

    return db.interestTag.findMany({
      where: {
        id: {
          in: interestTagIds,
        },
        isActive: true,
      },
    });
  }
}

@Injectable()
export class UserInterestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveByUser(
    userId: string,
    executor?: InterestsExecutor,
  ): Promise<(UserInterest & { interestTag: InterestTag })[]> {
    const db = executor ?? this.prisma;

    return db.userInterest.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        interestTag: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async listAllByUser(
    userId: string,
    executor: PrismaTransactionalClient,
  ): Promise<UserInterest[]> {
    return executor.userInterest.findMany({
      where: {
        userId,
      },
    });
  }

  async create(
    executor: PrismaTransactionalClient,
    userId: string,
    interestTagId: string,
  ): Promise<void> {
    await executor.userInterest.create({
      data: {
        userId,
        interestTagId,
      },
    });
  }

  async reactivate(
    executor: PrismaTransactionalClient,
    id: string,
  ): Promise<void> {
    await executor.userInterest.update({
      where: {
        id,
      },
      data: {
        deletedAt: null,
      },
    });
  }

  async softDelete(
    executor: PrismaTransactionalClient,
    id: string,
    deletedAt: Date,
  ): Promise<void> {
    await executor.userInterest.update({
      where: {
        id,
      },
      data: {
        deletedAt,
      },
    });
  }
}

@Injectable()
export class UserIntentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveByUser(
    userId: string,
    executor?: InterestsExecutor,
  ): Promise<Pick<UserIntent, "intent">[]> {
    const db = executor ?? this.prisma;

    return db.userIntent.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        intent: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async listAllByUser(
    userId: string,
    executor: PrismaTransactionalClient,
  ): Promise<UserIntent[]> {
    return executor.userIntent.findMany({
      where: {
        userId,
      },
    });
  }

  async create(
    executor: PrismaTransactionalClient,
    userId: string,
    intent: string,
  ): Promise<void> {
    await executor.userIntent.create({
      data: {
        userId,
        intent: intent as any,
      },
    });
  }

  async reactivate(
    executor: PrismaTransactionalClient,
    id: string,
  ): Promise<void> {
    await executor.userIntent.update({
      where: {
        id,
      },
      data: {
        deletedAt: null,
      },
    });
  }

  async softDelete(
    executor: PrismaTransactionalClient,
    id: string,
    deletedAt: Date,
  ): Promise<void> {
    await executor.userIntent.update({
      where: {
        id,
      },
      data: {
        deletedAt,
      },
    });
  }
}

@Injectable()
export class InterestProfileCompletionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(
    userId: string,
    executor?: InterestsExecutor,
  ): Promise<InterestCompletionRecord | null> {
    const db = executor ?? this.prisma;

    return db.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        profile: true,
        discoveryPreference: true,
        communicationPreference: true,
        intents: {
          where: {
            deletedAt: null,
          },
          select: {
            intent: true,
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
            isPrimary: true,
            moderationStatus: true,
          },
        },
      },
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
