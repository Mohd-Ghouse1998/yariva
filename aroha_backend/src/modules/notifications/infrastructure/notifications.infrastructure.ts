import { Injectable } from "@nestjs/common";
import { decodeDateIdCursor, encodeDateIdCursor } from "../../../common/utils/cursor.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  Notification,
  NotificationChannel,
  NotificationType,
  Prisma,
  PushToken,
  UserCommunicationPreference,
} from "../../../generated/prisma/client";

export interface NotificationCreateInput {
  userId: string;
  actorUserId?: string | null;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
  dedupeKey?: string | null;
}

export type NotificationWithActor = Prisma.NotificationGetPayload<{
  include: {
    actorUser: {
      select: {
        id: true;
        profile: { select: { displayName: true } };
      };
    };
  };
}>;

const notificationActorInclude = {
  actorUser: {
    select: {
      id: true,
      profile: { select: { displayName: true } },
    },
  },
} satisfies Prisma.NotificationInclude;

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(input: {
    userId: string;
    cursor?: string;
    limit: number;
  }): Promise<{ items: NotificationWithActor[]; nextCursor: string | null }> {
    const cursor = input.cursor ? decodeDateIdCursor(input.cursor) : null;
    const items = await this.prisma.notification.findMany({
      where: {
        userId: input.userId,
        deletedAt: null,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                {
                  createdAt: new Date(cursor.createdAt),
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      include: notificationActorInclude,
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

  async findById(notificationId: string): Promise<NotificationWithActor | null> {
    return this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: notificationActorInclude,
    });
  }

  async createOrGet(
    executor: PrismaTransactionalClient,
    input: NotificationCreateInput,
  ): Promise<{ notification: Notification; created: boolean }> {
    if (!input.dedupeKey) {
      return {
        notification: await executor.notification.create({
          data: this.toCreateData(input),
        }),
        created: true,
      };
    }

    // Read-then-create must share a lock across concurrent event/job retries.
    await executor.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`notification:${input.dedupeKey}`},0))`;
    const existing = await executor.notification.findUnique({
      where: { dedupeKey: input.dedupeKey },
    });
    if (existing) {
      return { notification: existing, created: false };
    }

    return {
      notification: await executor.notification.create({
        data: this.toCreateData(input),
      }),
      created: true,
    };
  }

  async markRead(
    executor: PrismaTransactionalClient,
    input: { notificationId: string; now: Date },
  ): Promise<Notification> {
    return executor.notification.update({
      where: { id: input.notificationId },
      data: {
        status: "READ",
        readAt: input.now,
      },
    });
  }

  async markSent(
    executor: PrismaTransactionalClient,
    notificationId: string,
    now: Date,
  ): Promise<Notification> {
    return executor.notification.update({
      where: { id: notificationId },
      data: {
        status: "SENT",
        sentAt: now,
        failedAt: null,
      },
    });
  }

  async markFailed(
    executor: PrismaTransactionalClient,
    notificationId: string,
    now: Date,
  ): Promise<Notification> {
    return executor.notification.update({
      where: { id: notificationId },
      data: {
        status: "FAILED",
        failedAt: now,
      },
    });
  }

  async markCanceled(
    executor: PrismaTransactionalClient,
    notificationId: string,
  ): Promise<Notification> {
    return executor.notification.update({
      where: { id: notificationId },
      data: { status: "CANCELED" },
    });
  }

  private toCreateData(
    input: NotificationCreateInput,
  ): Prisma.NotificationUncheckedCreateInput {
    return {
      userId: input.userId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      channel: input.channel,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      dedupeKey: input.dedupeKey ?? null,
      status: "PENDING",
    };
  }
}

@Injectable()
export class PushTokenReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listDispatchableForUser(userId: string): Promise<PushToken[]> {
    const now = new Date();
    return this.prisma.pushToken.findMany({
      where: {
        userId,
        invalidatedAt: null,
        deletedAt: null,
        OR: [
          { sessionId: null },
          {
            session: {
              revokedAt: null,
              deletedAt: null,
              refreshTokenExpiresAt: { gt: now },
            },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async findPreferences(userId: string): Promise<UserCommunicationPreference | null> {
    return this.prisma.userCommunicationPreference.findUnique({ where: { userId } });
  }

  async invalidate(tokenId: string, now: Date): Promise<void> {
    await this.prisma.pushToken.updateMany({
      where: { id: tokenId, invalidatedAt: null },
      data: { invalidatedAt: now },
    });
  }
}

@Injectable()
export class PushDeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async sentTokenIds(notificationId: string): Promise<Set<string>> {
    const rows = await this.prisma.pushDelivery.findMany({
      where: { notificationId, status: "SENT" },
      select: { pushTokenId: true },
    });
    return new Set(rows.map((row) => row.pushTokenId));
  }

  async record(input: {
    notificationId: string;
    pushTokenId: string;
    provider: "APNS" | "FCM";
    status: "SENT" | "FAILED" | "INVALID";
    providerMessageId?: string | null;
    errorCode?: string | null;
    now: Date;
  }): Promise<void> {
    await this.prisma.pushDelivery.upsert({
      where: {
        notificationId_pushTokenId: {
          notificationId: input.notificationId,
          pushTokenId: input.pushTokenId,
        },
      },
      create: {
        notificationId: input.notificationId,
        pushTokenId: input.pushTokenId,
        provider: input.provider,
        status: input.status,
        attempts: 1,
        providerMessageId: input.providerMessageId ?? null,
        lastErrorCode: input.errorCode ?? null,
        sentAt: input.status === "SENT" ? input.now : null,
      },
      update: {
        provider: input.provider,
        status: input.status,
        attempts: { increment: 1 },
        providerMessageId: input.providerMessageId ?? null,
        lastErrorCode: input.errorCode ?? null,
        sentAt: input.status === "SENT" ? input.now : null,
      },
    });
  }
}
