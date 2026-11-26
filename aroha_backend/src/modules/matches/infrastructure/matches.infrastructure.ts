import { Injectable } from "@nestjs/common";
import { Buffer } from "node:buffer";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  Conversation,
  Match,
  MatchCommunicationSetting,
  ProfilePhoto,
  User,
  UserInterest,
  UserIntent,
  UserLifestyle,
  UserProfile,
} from "../../../generated/prisma/client";

type MatchExecutor = PrismaService | PrismaTransactionalClient;

export async function findActiveMatchPartnerIds(db: MatchExecutor, viewerId: string, partnerIds: string[]) {
  if (!partnerIds.length) return new Set<string>();
  const matches = await db.match.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { userLowId: viewerId, userHighId: { in: partnerIds } },
        { userHighId: viewerId, userLowId: { in: partnerIds } },
      ],
    },
    select: { userLowId: true, userHighId: true },
  });
  return new Set(matches.map(({ userLowId, userHighId }) => userLowId === viewerId ? userHighId : userLowId));
}

export interface MatchProjection extends Match {
  conversation: Pick<
    Conversation,
    | "id"
    | "status"
    | "lastMessagePreview"
    | "lastMessageSentAt"
    | "closedAt"
    | "closedReason"
  > | null;
  communicationSettings: MatchCommunicationSetting[];
  userLow: User & MatchUserRelations;
  userHigh: User & MatchUserRelations;
}

interface MatchUserRelations {
  profile: UserProfile | null;
  photos: Pick<
    ProfilePhoto,
    "id" | "objectKey" | "bucket" | "width" | "height" | "isPrimary" | "position"
  >[];
  lifestyle: UserLifestyle | null;
  interests: (Pick<UserInterest, "interestTagId"> & {
    interestTag: {
      id: string;
      slug: string;
      displayName: string;
      category: string | null;
    };
  })[];
  intents: Pick<UserIntent, "intent">[];
}

@Injectable()
export class MatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(
    userId: string,
    input: {
      cursor?: string;
      limit: number;
    },
  ): Promise<{
    items: MatchProjection[];
    nextCursor: string | null;
  }> {
    const cursor = input.cursor ? decodeMatchCursor(input.cursor) : null;
    const items = (await this.prisma.match.findMany({
      where: {
        OR: [{ userLowId: userId }, { userHighId: userId }],
        ...(cursor
          ? {
              OR: [
                {
                  matchedAt: {
                    lt: new Date(cursor.matchedAt),
                  },
                },
                {
                  matchedAt: new Date(cursor.matchedAt),
                  id: {
                    lt: cursor.id,
                  },
                },
              ],
            }
          : {}),
      },
      include: matchInclude(),
      orderBy: [{ matchedAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    })) as unknown as MatchProjection[];

    const hasMore = items.length > input.limit;
    const pageItems = hasMore ? items.slice(0, input.limit) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems,
      nextCursor:
        hasMore && lastItem
          ? encodeMatchCursor({
              matchedAt: lastItem.matchedAt.toISOString(),
              id: lastItem.id,
            })
          : null,
    };
  }

  async findByIdForUser(
    matchId: string,
    userId: string,
    executor?: MatchExecutor,
  ): Promise<MatchProjection | null> {
    const db = executor ?? this.prisma;

    return (db.match.findFirst({
      where: {
        id: matchId,
        OR: [{ userLowId: userId }, { userHighId: userId }],
      },
      include: matchInclude(),
    })) as unknown as Promise<MatchProjection | null>;
  }

  async findById(
    matchId: string,
    executor?: MatchExecutor,
  ): Promise<Match | null> {
    const db = executor ?? this.prisma;

    return db.match.findUnique({
      where: {
        id: matchId,
      },
    });
  }

  async findByPair(
    userLowId: string,
    userHighId: string,
    executor?: MatchExecutor,
  ): Promise<Match | null> {
    const db = executor ?? this.prisma;

    return db.match.findUnique({
      where: {
        userLowId_userHighId: {
          userLowId,
          userHighId,
        },
      },
    });
  }

  async create(
    executor: PrismaTransactionalClient,
    input: {
      userLowId: string;
      userHighId: string;
      matchedAt: Date;
    },
  ): Promise<Match> {
    return executor.match.create({
      data: {
        userLowId: input.userLowId,
        userHighId: input.userHighId,
        matchedAt: input.matchedAt,
      },
    });
  }

  async end(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
      endedAt: Date;
      endedByUserId: string;
      endedReason: "UNMATCHED" | "BLOCKED" | "MODERATION" | "ACCOUNT_DELETED";
    },
  ): Promise<Match> {
    return executor.match.update({
      where: {
        id: input.matchId,
      },
      data: {
        status: "ENDED",
        endedAt: input.endedAt,
        endedByUserId: input.endedByUserId,
        endedReason: input.endedReason,
      },
    });
  }
}

@Injectable()
export class MatchCommunicationSettingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertDefaults(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
      userIds: [string, string];
    },
  ): Promise<MatchCommunicationSetting[]> {
    const settings: MatchCommunicationSetting[] = [];

    for (const userId of input.userIds) {
      const setting = await executor.matchCommunicationSetting.upsert({
        where: {
          matchId_userId: {
            matchId: input.matchId,
            userId,
          },
        },
        create: {
          matchId: input.matchId,
          userId,
        },
        update: {},
      });
      settings.push(setting);
    }

    return settings;
  }

  async updateForUser(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
      userId: string;
      allowVoiceCalls: boolean;
      allowVideoCalls: boolean;
      muted: boolean;
    },
  ): Promise<MatchCommunicationSetting> {
    return executor.matchCommunicationSetting.upsert({
      where: {
        matchId_userId: {
          matchId: input.matchId,
          userId: input.userId,
        },
      },
      create: {
        matchId: input.matchId,
        userId: input.userId,
        allowVoiceCalls: input.allowVoiceCalls,
        allowVideoCalls: input.allowVideoCalls,
        muted: input.muted,
      },
      update: {
        allowVoiceCalls: input.allowVoiceCalls,
        allowVideoCalls: input.allowVideoCalls,
        muted: input.muted,
      },
    });
  }
}

function matchInclude() {
  return {
    conversation: {
      select: {
        id: true,
        status: true,
        lastMessagePreview: true,
        lastMessageSentAt: true,
        closedAt: true,
        closedReason: true,
      },
    },
    communicationSettings: true,
    userLow: userInclude(),
    userHigh: userInclude(),
  };
}

function userInclude() {
  return {
    include: {
      profile: true,
      photos: {
        where: {
          moderationStatus: "APPROVED" as const,
          deletedAt: null,
          purpose: "PROFILE" as const,
        },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
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
      lifestyle: true,
      interests: {
        where: {
          deletedAt: null,
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
      intents: {
        where: {
          deletedAt: null,
        },
        select: {
          intent: true,
        },
      },
    },
  };
}

function encodeMatchCursor(value: {
  matchedAt: string;
  id: string;
}): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeMatchCursor(cursor: string): {
  matchedAt: string;
  id: string;
} {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as {
      matchedAt?: string;
      id?: string;
    };

    if (typeof parsed.matchedAt !== "string" || typeof parsed.id !== "string") {
      throw new Error("Invalid match cursor");
    }

    return {
      matchedAt: parsed.matchedAt,
      id: parsed.id,
    };
  } catch {
    throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
  }
}
