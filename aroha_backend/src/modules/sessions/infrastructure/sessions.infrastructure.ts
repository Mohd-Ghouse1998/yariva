import { Injectable } from "@nestjs/common";
import { decodeDateIdCursor, encodeDateIdCursor } from "../../../common/utils/cursor.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { PushToken, UserSession } from "../../../generated/prisma/client";

@Injectable()
export class UserSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(
    userId: string,
    input: {
      cursor?: string;
      limit: number;
    },
  ): Promise<{
    items: UserSession[];
    nextCursor: string | null;
  }> {
    const cursor = input.cursor ? decodeDateIdCursor(input.cursor) : null;
    const items = await this.prisma.userSession.findMany({
      where: {
        userId,
        deletedAt: null,
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

  async findById(sessionId: string): Promise<UserSession | null> {
    return this.prisma.userSession.findUnique({
      where: {
        id: sessionId,
      },
    });
  }

  async findLatestActiveByUserAndDevice(
    userId: string,
    deviceId: string,
  ): Promise<UserSession | null> {
    return this.prisma.userSession.findFirst({
      where: {
        userId,
        deviceId,
        deletedAt: null,
        revokedAt: null,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  async touchLastSeen(sessionId: string, now: Date): Promise<void> {
    await this.prisma.userSession.update({
      where: {
        id: sessionId,
      },
      data: {
        lastSeenAt: now,
      },
    });
  }

  async revokeById(
    executor: PrismaTransactionalClient,
    input: {
      sessionId: string;
      reason: string;
      now: Date;
    },
  ): Promise<void> {
    await executor.userSession.update({
      where: {
        id: input.sessionId,
      },
      data: {
        revokedAt: input.now,
        revokedReason: input.reason,
        currentRefreshTokenHash: "",
        previousRefreshTokenHash: null,
        previousRefreshTokenJti: null,
        previousRefreshTokenGraceUntil: null,
      },
    });
  }

  async revokeAllOtherSessions(
    executor: PrismaTransactionalClient,
    input: {
      userId: string;
      currentSessionId: string;
      now: Date;
    },
  ): Promise<number> {
    const sessions = await executor.userSession.findMany({
      where: {
        userId: input.userId,
        id: {
          not: input.currentSessionId,
        },
        deletedAt: null,
        revokedAt: null,
      },
      select: {
        id: true,
      },
    });

    for (const session of sessions) {
      await executor.userSession.update({
        where: {
          id: session.id,
        },
        data: {
          revokedAt: input.now,
          revokedReason: "user_revoked_other_sessions",
          currentRefreshTokenHash: "",
          previousRefreshTokenHash: null,
          previousRefreshTokenJti: null,
          previousRefreshTokenGraceUntil: null,
        },
      });
    }

    return sessions.length;
  }
}

@Injectable()
export class PushTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    executor: PrismaTransactionalClient,
    input: {
      userId: string;
      sessionId: string;
      token: string;
      platform: "IOS" | "ANDROID" | "WEB" | "UNKNOWN";
      provider: "APNS" | "FCM";
      deviceId: string | null;
      now: Date;
    },
  ): Promise<PushToken> {
    return executor.pushToken.upsert({
      where: {
        token: input.token,
      },
      create: {
        userId: input.userId,
        sessionId: input.sessionId,
        token: input.token,
        platform: input.platform,
        provider: input.provider,
        deviceId: input.deviceId,
        lastSeenAt: input.now,
      },
      update: {
        userId: input.userId,
        sessionId: input.sessionId,
        platform: input.platform,
        provider: input.provider,
        deviceId: input.deviceId,
        lastSeenAt: input.now,
        invalidatedAt: null,
        deletedAt: null,
      },
    });
  }

  async findById(pushTokenId: string): Promise<PushToken | null> {
    return this.prisma.pushToken.findUnique({
      where: {
        id: pushTokenId,
      },
    });
  }

  async invalidateById(
    executor: PrismaTransactionalClient,
    pushTokenId: string,
    now: Date,
  ): Promise<void> {
    await executor.pushToken.update({
      where: {
        id: pushTokenId,
      },
      data: {
        invalidatedAt: now,
        deletedAt: now,
      },
    });
  }
}
