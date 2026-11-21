import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type IORedis from "ioredis";
import { AppLogger } from "../../../common/logger/app-logger.service";
import type { DomainEventEnvelope } from "../../../common/services/domain-event.publisher";
import { RedisService } from "../../../integrations/redis/redis.service";
import { CreateNotificationService } from "../application/notifications.services";

@Injectable()
export class NotificationDomainEventSubscriberService
  implements OnModuleInit, OnModuleDestroy
{
  private subscriber: IORedis | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly createNotificationService: CreateNotificationService,
    private readonly logger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    this.subscriber = this.redis.duplicate();
    await this.subscriber.connect();
    await this.subscriber.subscribe("domain-events");
    this.subscriber.on("message", (_channel, payload) => {
      void this.handleMessage(payload);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.subscriber) {
      return;
    }

    await this.subscriber.unsubscribe("domain-events");
    await this.subscriber.quit();
    this.subscriber = null;
  }

  private async handleMessage(payload: string): Promise<void> {
    try {
      const envelope = JSON.parse(payload) as DomainEventEnvelope;
      const eventPayload =
        typeof envelope.payload === "object" && envelope.payload !== null
          ? (envelope.payload as Record<string, unknown>)
          : {};

      await this.createFromDomainEvent(envelope.name, eventPayload);
    } catch (error) {
      this.logger.warn(
        `Failed to process notification domain event: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }

  private async createFromDomainEvent(
    eventName: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (eventName === "match.created") {
      await this.createMatchNotifications(payload);
      return;
    }

    if (eventName === "conversation.message.created") {
      if (payload.inAppOnly === true) return;
      await this.createMessageNotifications(payload);
      return;
    }

    if (eventName === "call.missed") {
      await this.createMissedCallNotifications(payload);
      return;
    }
  }

  private async createMatchNotifications(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const userIds = Array.isArray(payload.userIds)
      ? payload.userIds.map(String)
      : [];
    const matchId = typeof payload.matchId === "string" ? payload.matchId : null;
    const conversationId =
      typeof payload.conversationId === "string" ? payload.conversationId : null;

    for (const userId of userIds) {
      await this.createNotificationService.execute({
        userId,
        type: "NEW_MATCH",
        title: "New match",
        body: "You have a new match.",
        data: { matchId, conversationId },
        dedupeKey: ["NEW_MATCH", matchId, userId].join(":"),
      });
    }
  }

  private async createMessageNotifications(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const recipientUserIds = Array.isArray(payload.recipientUserIds)
      ? payload.recipientUserIds.map(String)
      : [];
    const messagesByUserId =
      typeof payload.messageByUserId === "object" &&
      payload.messageByUserId !== null
        ? (payload.messageByUserId as Record<string, unknown>)
        : {};
    const conversationId =
      typeof payload.conversationId === "string" ? payload.conversationId : null;

    for (const userId of recipientUserIds) {
      const message =
        typeof messagesByUserId[userId] === "object" &&
        messagesByUserId[userId] !== null
          ? (messagesByUserId[userId] as Record<string, unknown>)
          : null;
      if (!message || message.senderId === userId) {
        continue;
      }

      await this.createNotificationService.execute({
        userId,
        actorUserId:
          typeof message.senderId === "string" ? message.senderId : null,
        type: "NEW_MESSAGE",
        title: "New message",
        body: "You have a new message.",
        data: {
          conversationId,
          messageId: message.id,
          sequence: message.sequence,
        },
        dedupeKey: ["NEW_MESSAGE", message.id, userId].join(":"),
      });
    }
  }

  private async createMissedCallNotifications(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const call =
      typeof payload.call === "object" && payload.call !== null
        ? (payload.call as Record<string, unknown>)
        : null;
    if (!call || typeof call.receiverUserId !== "string") {
      return;
    }

    await this.createNotificationService.execute({
      userId: call.receiverUserId,
      actorUserId:
        typeof call.initiatorUserId === "string" ? call.initiatorUserId : null,
      type: "MISSED_CALL",
      title: "Missed call",
      body: "You missed a call.",
      data: {
        callId: call.id,
        matchId: call.matchId,
        conversationId: call.conversationId,
      },
      dedupeKey: ["MISSED_CALL", call.id, call.receiverUserId].join(":"),
    });
  }
}

