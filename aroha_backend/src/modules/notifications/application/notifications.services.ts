import { Injectable } from "@nestjs/common";
import { EvaluateFeatureFlagService } from "../../feature-flags/application/feature-flags.services";
import { AppLogger } from "../../../common/logger/app-logger.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { BullmqProducer } from "../../../integrations/bullmq/bullmq.producer";
import type {
  Notification,
  NotificationChannel,
  NotificationType,
  Prisma,
} from "../../../generated/prisma/client";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { NOTIFICATION_EVENTS } from "../events/notification.events";
import type {
  NotificationDto,
  NotificationPageDto,
  NotificationResponseDto,
} from "../dto/notifications.dto";
import { NotificationOwnershipPolicy } from "../domain/notifications.domain";
import {
  NotificationRepository,
  PushDeliveryRepository,
  type NotificationWithActor,
  PushTokenReadRepository,
} from "../infrastructure/notifications.infrastructure";
import {
  ApnsPushTransport,
  FcmPushTransport,
  PushTransportError,
} from "../infrastructure/push-transports";

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

@Injectable()
export class ListNotificationsService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(input: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<NotificationPageDto> {
    const page = await this.notificationRepository.listByUser({
      userId: input.userId,
      cursor: input.cursor,
      limit: input.limit ?? 20,
    });

    return {
      items: page.items.map(mapNotification),
      nextCursor: page.nextCursor,
    };
  }
}

@Injectable()
export class MarkNotificationReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationRepository: NotificationRepository,
    private readonly ownershipPolicy: NotificationOwnershipPolicy,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: {
    userId: string;
    notificationId: string;
  }): Promise<NotificationResponseDto> {
    const notification = await this.notificationRepository.findById(
      input.notificationId,
    );
    if (!notification || notification.deletedAt) {
      throw new AppException(
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "Notification not found",
      );
    }
    this.ownershipPolicy.assertOwned(input.userId, notification);

    const updated = await this.prisma.$transaction((tx) =>
      this.notificationRepository.markRead(tx, {
        notificationId: notification.id,
        now: new Date(),
      }),
    );

    await this.domainEventPublisher.publishSafely(NOTIFICATION_EVENTS.READ, {
      notificationId: updated.id,
      userId: updated.userId,
      readAt: updated.readAt?.toISOString() ?? null,
    });

    return { notification: mapNotification(updated) };
  }
}

@Injectable()
export class CreateNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationRepository: NotificationRepository,
    private readonly bullmqProducer: BullmqProducer,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: AppLogger,
  ) {}

  async execute(input: CreateNotificationInput): Promise<{
    notification: NotificationDto;
    created: boolean;
  }> {
    const result = await this.prisma.$transaction((tx) =>
      this.notificationRepository.createOrGet(tx, {
        userId: input.userId,
        actorUserId: input.actorUserId ?? null,
        type: input.type,
        channel: input.channel ?? "PUSH",
        title: input.title,
        body: input.body,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
        dedupeKey: input.dedupeKey ?? null,
      }),
    );

    const dto = mapNotification(result.notification);
    if (!result.created) {
      return { notification: dto, created: false };
    }

    await this.domainEventPublisher.publishSafely(NOTIFICATION_EVENTS.CREATED, {
      notification: dto,
      recipientUserIds: [result.notification.userId],
    });

    await this.enqueueDispatchSafely(result.notification.id);
    return { notification: dto, created: true };
  }

  private async enqueueDispatchSafely(notificationId: string): Promise<void> {
    try {
      await this.bullmqProducer.enqueue(
        "notification.dispatch",
        { notificationId },
        { jobId: `notification.dispatch:${notificationId}` },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue notification dispatch ${notificationId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

@Injectable()
export class PushDispatcherService {
  constructor(
    private readonly pushTokenRepository: PushTokenReadRepository,
    private readonly pushDeliveryRepository: PushDeliveryRepository,
    private readonly fcm: FcmPushTransport,
    private readonly apns: ApnsPushTransport,
    private readonly logger: AppLogger,
  ) {}

  async dispatch(
    notification: Notification,
  ): Promise<"DELIVERED" | "SUPPRESSED" | "UNDELIVERABLE"> {
    if (notification.channel !== "PUSH") {
      return "SUPPRESSED";
    }

    const [tokens, preferences, sentTokenIds] = await Promise.all([
      this.pushTokenRepository.listDispatchableForUser(notification.userId),
      this.pushTokenRepository.findPreferences(notification.userId),
      this.pushDeliveryRepository.sentTokenIds(notification.id),
    ]);
    if (!isPushAllowed(notification.type, preferences)) return "SUPPRESSED";
    const pending = tokens.filter((token) => !sentTokenIds.has(token.id));
    if (pending.length === 0)
      return sentTokenIds.size > 0 ? "DELIVERED" : "SUPPRESSED";

    let delivered = sentTokenIds.size > 0;
    let firstFailure: unknown = null;
    for (const token of pending) {
      const transport = token.provider === "FCM" ? this.fcm : this.apns;
      const now = new Date();
      try {
        const result = await transport.send({
          token: token.token,
          title: notification.title,
          body: notification.body,
          data: normalizeJsonObject(notification.data),
        });
        if (result.outcome === "INVALID_TOKEN") {
          await Promise.all([
            this.pushTokenRepository.invalidate(token.id, now),
            this.pushDeliveryRepository.record({
              notificationId: notification.id,
              pushTokenId: token.id,
              provider: token.provider,
              status: "INVALID",
              errorCode: result.reason,
              now,
            }),
          ]);
          continue;
        }
        delivered = true;
        await this.pushDeliveryRepository.record({
          notificationId: notification.id,
          pushTokenId: token.id,
          provider: token.provider,
          status: "SENT",
          providerMessageId: result.providerMessageId,
          now,
        });
      } catch (error) {
        firstFailure ??= error;
        const code =
          error instanceof PushTransportError
            ? error.code
            : "PUSH_TRANSPORT_ERROR";
        await this.pushDeliveryRepository.record({
          notificationId: notification.id,
          pushTokenId: token.id,
          provider: token.provider,
          status: "FAILED",
          errorCode: code,
          now,
        });
        this.logger.warn(
          `Push delivery failed for ${token.provider} token ${token.id}: ${code}`,
        );
      }
    }

    if (firstFailure) throw firstFailure;
    return delivered ? "DELIVERED" : "UNDELIVERABLE";
  }
}

@Injectable()
export class NotificationDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationRepository: NotificationRepository,
    private readonly pushDispatcherService: PushDispatcherService,
    private readonly createNotificationService: CreateNotificationService,
    private readonly featureFlags: EvaluateFeatureFlagService,
  ) {}

  async execute(payload: Record<string, unknown>): Promise<void> {
    const notificationId =
      typeof payload.notificationId === "string"
        ? payload.notificationId
        : null;

    if (!notificationId) {
      await this.createFromLegacyPayload(payload);
      return;
    }

    const notification =
      await this.notificationRepository.findById(notificationId);
    if (
      !notification ||
      notification.deletedAt ||
      notification.status === "READ" ||
      notification.status === "CANCELED"
    ) {
      return;
    }

    if (normalizeJsonObject(notification.data).route === "weekly-recap") {
      const prefs = await this.prisma.userStreak.findUnique({
        where: { userId: notification.userId },
      });
      const flag = await this.featureFlags.execute({
        key: "activity.v1",
        userId: notification.userId,
      });
      if (!prefs?.recapNotificationsEnabled || !flag.enabled) {
        await this.prisma.$transaction((tx) =>
          this.notificationRepository.markCanceled(tx, notification.id),
        );
        return;
      }
    }
    try {
      const outcome = await this.pushDispatcherService.dispatch(notification);
      await this.prisma.$transaction((tx) => {
        if (outcome === "DELIVERED") {
          return this.notificationRepository.markSent(
            tx,
            notification.id,
            new Date(),
          );
        }
        if (outcome === "SUPPRESSED") {
          return this.notificationRepository.markCanceled(tx, notification.id);
        }
        return this.notificationRepository.markFailed(
          tx,
          notification.id,
          new Date(),
        );
      });
    } catch (error) {
      await this.prisma.$transaction((tx) =>
        this.notificationRepository.markFailed(tx, notification.id, new Date()),
      );
      throw error;
    }
  }

  private async createFromLegacyPayload(
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (
      payload.type !== "NEW_MATCH" ||
      typeof payload.recipientUserId !== "string"
    ) {
      return;
    }

    await this.createNotificationService.execute({
      userId: payload.recipientUserId,
      actorUserId:
        typeof payload.actorUserId === "string" ? payload.actorUserId : null,
      type: "NEW_MATCH",
      channel: "PUSH",
      title: "New match",
      body: "You have a new match.",
      data: {
        matchId: payload.matchId,
        conversationId: payload.conversationId,
      },
      dedupeKey: ["NEW_MATCH", payload.matchId, payload.recipientUserId].join(
        ":",
      ),
    });
  }
}

function isPushAllowed(
  type: NotificationType,
  preferences: {
    allowPushMatches: boolean;
    allowPushMessages: boolean;
    allowPushCalls: boolean;
  } | null,
): boolean {
  if (!preferences) return true;
  if (type === "NEW_LIKE" || type === "NEW_MATCH")
    return preferences.allowPushMatches;
  if (type === "NEW_MESSAGE") return preferences.allowPushMessages;
  if (type === "MISSED_CALL") return preferences.allowPushCalls;
  return true;
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

function normalizeJsonObject(
  value: Prisma.JsonValue | null,
): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
