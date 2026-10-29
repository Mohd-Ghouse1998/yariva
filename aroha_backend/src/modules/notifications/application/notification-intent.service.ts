import { Injectable } from "@nestjs/common";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AppLogger } from "../../../common/logger/app-logger.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import { BullmqProducer } from "../../../integrations/bullmq/bullmq.producer";
import type { Notification, NotificationChannel, NotificationType, Prisma } from "../../../generated/prisma/client";
import { NotificationRepository, type NotificationWithActor } from "../infrastructure/notifications.infrastructure";
import type { NotificationDto } from "../dto/notifications.dto";
import { NOTIFICATION_EVENTS } from "../events/notification.events";

export interface CreateNotificationInput {
  userId: string;
  actorUserId?: string | null;
  type: NotificationType;
  channel?: NotificationChannel;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  dedupeKey?: string | null;
}

// Internal persistence/dispatch shared by authorized business transactions.
// Callers must enforce their policy before persisting; reads and delivery recheck it.
@Injectable()
export class NotificationIntentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationRepository: NotificationRepository,
    private readonly bullmqProducer: BullmqProducer,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: AppLogger,
  ) {}

  // Callers with a business transaction persist intent atomically, then dispatch
  // after commit. Pending rows are recovered by the worker if that process exits.
  async persist(tx: PrismaTransactionalClient, input: CreateNotificationInput) {
    return this.notificationRepository.createOrGet(tx, {
      userId: input.userId, actorUserId: input.actorUserId ?? null,
      type: input.type, channel: input.channel ?? "PUSH",
      title: input.title, body: input.body,
      data: (input.data ?? {}) as Prisma.InputJsonValue,
      dedupeKey: input.dedupeKey ?? null,
    });
  }

  async dispatchPersisted(result: { notification: Notification; created: boolean }): Promise<void> {
    if (result.created) await this.domainEventPublisher.publishSafely(NOTIFICATION_EVENTS.CREATED, {
      notification: mapNotification(result.notification), recipientUserIds: [result.notification.userId],
    });
    if (result.notification.status === "PENDING") await this.enqueueDispatchSafely(result.notification.id);
  }

  async recoverPending(now = new Date()): Promise<void> {
    const pending = await this.prisma.notification.findMany({
      where: { status: "PENDING", deletedAt: null, createdAt: { lt: new Date(now.getTime() - 60_000) } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100,
    });
    for (const notification of pending) await this.enqueueDispatchSafely(notification.id, true);
  }

  private async enqueueDispatchSafely(notificationId: string, retryFinished = false): Promise<void> {
    try {
      await this.bullmqProducer.enqueue(
        "notification.dispatch",
        { notificationId },
        { jobId: `notification.dispatch:${notificationId}`, ...(retryFinished ? { retryFinished: true } : {}) },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue notification dispatch ${notificationId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

export function mapNotification(
  notification: Notification | NotificationWithActor,
): NotificationDto {
  const actorUser = "actorUser" in notification ? notification.actorUser : null;
  return {
    id: notification.id,
    type: notification.type,
    channel: notification.channel,
    title: notification.title,
    body: notification.body,
    data: normalizeJsonObject(notification.data),
    actor: notification.actorUserId
      ? {
          userId: notification.actorUserId,
          displayName: actorUser?.profile?.displayName ?? null,
        }
      : null,
    status: notification.status,
    readAt: notification.readAt?.toISOString() ?? null,
    sentAt: notification.sentAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export function normalizeJsonObject(
  value: Prisma.JsonValue | null,
): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
