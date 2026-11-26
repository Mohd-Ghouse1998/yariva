import { canReadEventPlanNotice } from "../../events/event-notices.service";
import { NotificationIntentService, mapNotification, normalizeJsonObject, type CreateNotificationInput } from "./notification-intent.service";
import { isSocialNoticeRoute } from "../../social/social-notice-data";
import { canReadSocialNotice } from "../../social/social-notice-policy";
export { mapNotification, type CreateNotificationInput } from "./notification-intent.service";
import { resolveMutualMeetAgain } from "../../date-plans/domain/date-plans.privacy";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import { Injectable } from "@nestjs/common";
import { EvaluateFeatureFlagService } from "../../feature-flags/application/feature-flags.services";
import { PrivateStoriesService } from "../../private-stories/application/private-stories.service";
import { AppLogger } from "../../../common/logger/app-logger.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type {
  Notification,
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
  PushTokenReadRepository,
} from "../infrastructure/notifications.infrastructure";
import {
  ApnsPushTransport,
  FcmPushTransport,
  PushTransportError,
} from "../infrastructure/push-transports";

@Injectable()
export class ListNotificationsService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly stories: PrivateStoriesService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<NotificationPageDto> {
    const limit = input.limit ?? 20;
    const items: NotificationDto[] = [];
    let cursor = input.cursor;
    let nextCursor: string | null = null;
    // Continue past inaccessible Stories without hiding later valid activity.
    // Bound work per request; callers can continue with the scanned cursor.
    for (let scan = 0; scan < 5; scan++) {
      const page = await this.notificationRepository.listByUser({
        userId: input.userId, cursor, limit: limit - items.length,
      });
      for (const notification of page.items) {
        if (await canReadNotification(this.stories, this.prisma, notification)) items.push(mapNotification(notification));
      }
      nextCursor = page.nextCursor;
      if (items.length === limit || !nextCursor) break;
      cursor = nextCursor;
    }
    return { items, nextCursor };
  }
}

@Injectable()
export class MarkNotificationReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationRepository: NotificationRepository,
    private readonly ownershipPolicy: NotificationOwnershipPolicy,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly stories: PrivateStoriesService,
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
    if (!await canReadNotification(this.stories, this.prisma, notification)) throw notificationMissing();

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
    private readonly intents: NotificationIntentService,
    private readonly stories: PrivateStoriesService,
  ) {}

  async execute(input: CreateNotificationInput): Promise<{ notification: NotificationDto; created: boolean }> {
    const result = await this.prisma.$transaction((tx) => this.persist(tx, input));
    await this.dispatchPersisted(result);
    return { notification: mapNotification(result.notification), created: result.created };
  }

  async persist(tx: PrismaTransactionalClient, input: CreateNotificationInput) {
    if (!await canReadNotification(this.stories, tx, input)) throw notificationMissing();
    return this.intents.persist(tx, input);
  }

  async dispatchPersisted(result: { notification: Notification; created: boolean }): Promise<void> {
    if (!await canReadNotification(this.stories, this.prisma, result.notification)) return;
    await this.intents.dispatchPersisted(result);
  }

  async recoverPending(now = new Date()): Promise<void> {
    await this.intents.recoverPending(now);
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
    private readonly stories: PrivateStoriesService,
    private readonly prisma: PrismaService,
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
    const data = normalizeJsonObject(notification.data);
    const social = isSocialNoticeRoute(data.route);
    const requiresSocialOptIn = social && data.route !== "circle-message";
    if (!isPushAllowed(notification.type, preferences, requiresSocialOptIn)) return "SUPPRESSED";
    const pending = tokens.filter((token) => !sentTokenIds.has(token.id));
    if (pending.length === 0)
      return sentTokenIds.size > 0 ? "DELIVERED" : "SUPPRESSED";

    let delivered = sentTokenIds.size > 0;
    let attempted = false;
    let firstFailure: unknown = null;
    for (const token of pending) {
      // Access or device ownership can change while a previous token is pending.
      if (!await canReadNotification(this.stories, this.prisma, notification)) return social && delivered ? "DELIVERED" : "SUPPRESSED";
      if (social) {
        const [registered, currentPreferences] = await Promise.all([
          this.pushTokenRepository.isDispatchableForUser(token),
          this.pushTokenRepository.findPreferences(notification.userId),
        ]);
        if (!isPushAllowed(notification.type, currentPreferences, requiresSocialOptIn)) {
          return delivered ? "DELIVERED" : "SUPPRESSED";
        }
        if (!registered) continue;
      }
      const transport = token.provider === "FCM" ? this.fcm : this.apns;
      const now = new Date();
      try {
        attempted = true;
        const result = await transport.send({
          token: token.token,
          title: social ? "Yariva" : notification.title,
          body: social ? "You have a new update." : notification.body,
          data: social ? { route: "social-notification", notificationId: notification.id } : data,
        });
        if (result.outcome === "INVALID_TOKEN") {
          await Promise.all([
            this.pushTokenRepository.invalidate(token, now),
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
    if (delivered) return "DELIVERED";
    return attempted ? "UNDELIVERABLE" : "SUPPRESSED";
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
    private readonly stories: PrivateStoriesService,
  ) {}

  async execute(payload: Record<string, unknown>): Promise<void> {
    const notificationId =
      typeof payload.notificationId === "string"
        ? payload.notificationId
        : null;

    if (!notificationId) {
      if (payload.type === "PRIVATE_STORY_SHARED" && typeof payload.storyId === "string") {
        const grants = await this.prisma.privateStoryGrant.findMany({
          where: { storyId: payload.storyId }, select: { recipientId: true },
        });
        for (const { recipientId } of grants) {
          if (!await this.stories.canAccess(recipientId, payload.storyId)) continue;
          try {
            await this.createNotificationService.execute({
              userId: recipientId, type: "SYSTEM", title: "New update",
              body: "A private Story is available in Yariva.",
              data: { route: "private-story", storyId: payload.storyId },
              dedupeKey: `private-story:${payload.storyId}:${recipientId}`,
            });
          } catch (error) {
            // A revoke between the audience check and creation is expected.
            if (!(error instanceof AppException && error.getStatus() === 404)) throw error;
          }
        }
        return;
      }
      await this.createFromLegacyPayload(payload);
      return;
    }

    const notification =
      await this.notificationRepository.findById(notificationId);
    if (
      !notification ||
      notification.deletedAt ||
      notification.status === "READ" ||
      notification.status === "SENT" ||
      notification.status === "CANCELED"
    ) {
      return;
    }

    if (!await canReadNotification(this.stories, this.prisma, notification)) {
      await this.prisma.$transaction((tx) => this.notificationRepository.markCanceled(tx, notification.id));
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

function notificationMissing() {
  return new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Notification not found");
}

async function canReadNotification(
  stories: PrivateStoriesService,
  db: PrismaTransactionalClient,
  notification: { userId: string; type?: NotificationType; data?: unknown },
): Promise<boolean> {
  const data = normalizeJsonObject(notification.data as Prisma.JsonValue | null);
  if (isSocialNoticeRoute(data.route)) return canReadSocialNotice(db, notification.userId, data);
  if (data.route === "event-plan-change") return canReadEventPlanNotice(db, notification);
  if (data.route === "private-story") {
    return typeof data.storyId === "string" && await stories.canAccess(notification.userId, data.storyId, db);
  }
  if (notification.type !== "MUTUAL_MEET_AGAIN") return true;
  if (typeof data.datePlanId !== "string") return false;
  const plan = await db.datePlan.findUnique({
    where: { id: data.datePlanId },
    select: { status: true, checkIns: { select: { userId: true, wantsToMeetAgain: true, postDateSubmittedAt: true } },
      match: { select: { status: true, userLowId: true, userHighId: true,
        userLow: { select: { status: true, deletedAt: true } }, userHigh: { select: { status: true, deletedAt: true } } } } },
  });
  if (!plan || plan.status !== "COMPLETED" || plan.match.status !== "ACTIVE") return false;
  const { userLowId, userHighId, userLow, userHigh } = plan.match;
  if (![userLowId, userHighId].includes(notification.userId) ||
      [userLow, userHigh].some(user => user.status !== "ACTIVE" || user.deletedAt)) return false;
  const responses = [userLowId, userHighId].map(userId => {
    const answer = plan.checkIns.find(item => item.userId === userId && item.postDateSubmittedAt);
    return answer?.wantsToMeetAgain;
  });
  if (resolveMutualMeetAgain(responses) !== "MUTUAL") return false;
  return !await db.block.findFirst({ where: { deletedAt: null, OR: [
    { blockerId: userLowId, blockedId: userHighId }, { blockerId: userHighId, blockedId: userLowId },
  ] }, select: { id: true } });
}

function isPushAllowed(
  type: NotificationType,
  preferences: {
    allowPushMatches: boolean;
    allowPushMessages: boolean;
    allowPushCalls: boolean;
    allowPushSocial: boolean;
  } | null,
  requiresSocialOptIn: boolean,
): boolean {
  if (requiresSocialOptIn) return preferences?.allowPushSocial === true;
  if (!preferences) return true;
  if (type === "NEW_LIKE" || type === "NEW_MATCH")
    return preferences.allowPushMatches;
  if (type === "NEW_MESSAGE") return preferences.allowPushMessages;
  if (type === "MISSED_CALL") return preferences.allowPushCalls;
  return true;
}
