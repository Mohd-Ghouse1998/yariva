import { ConversationRepository } from "../../conversations/infrastructure/conversations.infrastructure";
import { CallAccessService } from "../../calls/application/calls.services";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io";
import { AppLogger } from "../../../common/logger/app-logger.service";
import { AppException } from "../../../common/errors/app.exception";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { UserSessionRepository } from "../../sessions/infrastructure/sessions.infrastructure";
import { UserRepository } from "../../users/infrastructure/users.infrastructure";
import { CALL_EVENTS } from "../../calls/events/calls.events";
import {
  type PresenceUpdatedEventDto,
  type WsReadyDto,
  type WsSystemErrorDto,
} from "../dto/presence.dto";
import { PresencePolicyService } from "../domain/presence.domain";
import { PRESENCE_EVENTS } from "../events/presence.events";
import {
  PresenceRepository,
  type PresenceSnapshot,
} from "../infrastructure/presence.repository";
import { SocketRegistryRepository } from "../infrastructure/socket-registry.repository";
import { TypingStateRepository } from "../infrastructure/typing-state.repository";

interface LocalSocketRecord {
  socket: Socket;
  userId: string;
  sessionId: string;
}

@Injectable()
export class SocketRegistryService implements OnModuleDestroy {
  private readonly socketsByConnectionId = new Map<string, LocalSocketRecord>();
  private readonly connectionIdsByUserId = new Map<string, Set<string>>();

  registerLocalSocket(
    connectionId: string,
    userId: string,
    sessionId: string,
    socket: Socket,
  ): void {
    this.socketsByConnectionId.set(connectionId, {
      socket,
      userId,
      sessionId,
    });

    const existing = this.connectionIdsByUserId.get(userId) ?? new Set<string>();
    existing.add(connectionId);
    this.connectionIdsByUserId.set(userId, existing);
  }

  unregisterLocalSocket(connectionId: string): void {
    const existing = this.socketsByConnectionId.get(connectionId);
    if (!existing) {
      return;
    }

    this.socketsByConnectionId.delete(connectionId);
    const byUser = this.connectionIdsByUserId.get(existing.userId);
    if (!byUser) {
      return;
    }

    byUser.delete(connectionId);
    if (byUser.size === 0) {
      this.connectionIdsByUserId.delete(existing.userId);
    }
  }

  emitToUsers(userIds: string[], eventName: string, payload: unknown): void {
    const uniqueUserIds = [...new Set(userIds)];
    for (const userId of uniqueUserIds) {
      const connectionIds = this.connectionIdsByUserId.get(userId);
      if (!connectionIds) {
        continue;
      }

      for (const connectionId of connectionIds) {
        const record = this.socketsByConnectionId.get(connectionId);
        record?.socket.emit(eventName, payload);
      }
    }
  }

  emitToConnection(
    connectionId: string,
    eventName: string,
    payload: unknown,
  ): void {
    this.socketsByConnectionId.get(connectionId)?.socket.emit(eventName, payload);
  }

  emitToUserSession(
    userId: string,
    sessionId: string,
    eventName: string,
    payload: unknown,
  ): void {
    const connectionIds = this.connectionIdsByUserId.get(userId);
    if (!connectionIds) {
      return;
    }

    for (const connectionId of connectionIds) {
      const record = this.socketsByConnectionId.get(connectionId);
      if (record?.sessionId === sessionId) {
        record.socket.emit(eventName, payload);
      }
    }
  }

  emitToUserExceptSession(
    userId: string,
    excludedSessionId: string,
    eventName: string,
    payload: unknown,
  ): void {
    const connectionIds = this.connectionIdsByUserId.get(userId);
    if (!connectionIds) {
      return;
    }

    for (const connectionId of connectionIds) {
      const record = this.socketsByConnectionId.get(connectionId);
      if (record && record.sessionId !== excludedSessionId) {
        record.socket.emit(eventName, payload);
      }
    }
  }

  onModuleDestroy(): void {
    this.socketsByConnectionId.clear();
    this.connectionIdsByUserId.clear();
  }
}

@Injectable()
export class RegisterSocketService {
  constructor(
    private readonly socketRegistryRepository: SocketRegistryRepository,
    private readonly presenceRepository: PresenceRepository,
    private readonly sessionRepository: UserSessionRepository,
    private readonly userRepository: UserRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: {
    connectionId: string;
    socketId: string;
    authContext: AuthContext;
  }): Promise<WsReadyDto> {
    const now = new Date();
    const nowIso = now.toISOString();

    await this.socketRegistryRepository.register({
      connectionId: input.connectionId,
      socketId: input.socketId,
      userId: input.authContext.user.id,
      sessionId: input.authContext.session.id,
      connectedAt: nowIso,
      lastHeartbeatAt: nowIso,
    });
    await this.presenceRepository.markOnline(input.authContext.user.id, nowIso);
    await this.sessionRepository.touchLastSeen(input.authContext.session.id, now);
    await this.userRepository.touchLastActiveAt(input.authContext.user.id, now);

    const activeConnectionCount =
      await this.socketRegistryRepository.countActiveConnectionsForUser(
        input.authContext.user.id,
      );

    if (activeConnectionCount === 1) {
      await this.domainEventPublisher.publishSafely(PRESENCE_EVENTS.UPDATED, {
        userId: input.authContext.user.id,
        status: "ONLINE",
        updatedAt: nowIso,
        recipientUserIds: [input.authContext.user.id],
      } satisfies PresenceUpdatedEventDto & { recipientUserIds: string[] });
    }

    return {
      connectionId: input.connectionId,
      userId: input.authContext.user.id,
      sessionId: input.authContext.session.id,
      serverTime: nowIso,
    };
  }
}

@Injectable()
export class HeartbeatPresenceService {
  constructor(
    private readonly presencePolicyService: PresencePolicyService,
    private readonly socketRegistryRepository: SocketRegistryRepository,
    private readonly presenceRepository: PresenceRepository,
    private readonly sessionRepository: UserSessionRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: {
    connectionId: string;
    sessionId: string;
    status: "ONLINE";
  }): Promise<void> {
    this.presencePolicyService.assertHeartbeatStatus(input.status);

    const now = new Date();
    const connection =
      await this.socketRegistryRepository.refreshHeartbeat(
        input.connectionId,
        now.toISOString(),
      );
    if (!connection) {
      throw new AppException(
        401,
        ERROR_CODES.SESSION_INVALID,
        "Socket session is no longer active",
      );
    }

    if (connection.sessionId !== input.sessionId) {
      throw new AppException(
        401,
        ERROR_CODES.SESSION_INVALID,
        "Socket session is invalid",
      );
    }

    await this.presenceRepository.markOnline(connection.userId, now.toISOString());
    await this.sessionRepository.touchLastSeen(input.sessionId, now);
    await this.userRepository.touchLastActiveAt(connection.userId, now);
  }
}

@Injectable()
export class GetPresenceService {
  constructor(private readonly presenceRepository: PresenceRepository) {}

  async execute(userId: string): Promise<PresenceSnapshot | null> {
    return this.presenceRepository.get(userId);
  }
}

@Injectable()
export class ConversationTypingStateService {
  constructor(
    private readonly typingStateRepository: TypingStateRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async start(input: {
    conversationId: string;
    userId: string;
    connectionId: string;
    recipientUserIds: string[];
  }): Promise<string> {
    await this.typingStateRepository.startTyping({
      conversationId: input.conversationId,
      userId: input.userId,
      connectionId: input.connectionId,
      recipientUserIds: input.recipientUserIds,
    });

    const expiresAt = this.typingStateRepository.getExpiresAt();
    await this.domainEventPublisher.publishSafely("message.typing", {
      conversationId: input.conversationId,
      userId: input.userId,
      recipientUserIds: input.recipientUserIds,
      isTyping: true,
      expiresAt,
    });

    return expiresAt;
  }

  async stop(input: {
    conversationId: string;
    userId: string;
    connectionId: string;
    recipientUserIds: string[];
  }): Promise<void> {
    await this.typingStateRepository.stopTyping({
      conversationId: input.conversationId,
      userId: input.userId,
      connectionId: input.connectionId,
    });

    const activeCount = await this.typingStateRepository.countTypingConnections(
      input.conversationId,
      input.userId,
    );
    if (activeCount === 0) {
      await this.domainEventPublisher.publishSafely("message.typing", {
        conversationId: input.conversationId,
        userId: input.userId,
        recipientUserIds: input.recipientUserIds,
        isTyping: false,
        expiresAt: new Date().toISOString(),
      });
    }
  }

  async clearConnection(connectionId: string): Promise<void> {
    const entries = await this.typingStateRepository.clearConnection(connectionId);
    for (const entry of entries) {
      const activeCount = await this.typingStateRepository.countTypingConnections(
        entry.conversationId,
        entry.userId,
      );
      if (activeCount === 0) {
        await this.domainEventPublisher.publishSafely("message.typing", {
          conversationId: entry.conversationId,
          userId: entry.userId,
          recipientUserIds: entry.recipientUserIds,
          isTyping: false,
          expiresAt: new Date().toISOString(),
        });
      }
    }
  }
}

@Injectable()
export class UnregisterSocketService {
  constructor(
    private readonly socketRegistryRepository: SocketRegistryRepository,
    private readonly presenceRepository: PresenceRepository,
    private readonly conversationTypingStateService: ConversationTypingStateService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(connectionId: string): Promise<void> {
    const connection = await this.socketRegistryRepository.unregister(connectionId);
    await this.conversationTypingStateService.clearConnection(connectionId);

    if (!connection) {
      return;
    }

    const remainingConnections =
      await this.socketRegistryRepository.countActiveConnectionsForUser(
        connection.userId,
      );
    if (remainingConnections === 0) {
      const updatedAt = new Date().toISOString();
      await this.presenceRepository.markOffline(connection.userId, updatedAt);
      await this.domainEventPublisher.publishSafely(PRESENCE_EVENTS.UPDATED, {
        userId: connection.userId,
        status: "OFFLINE",
        updatedAt,
        recipientUserIds: [connection.userId],
      } satisfies PresenceUpdatedEventDto & { recipientUserIds: string[] });
    }
  }
}

@Injectable()
export class PresenceRealtimeFanoutService {
  constructor(
    private readonly socketRegistryService: SocketRegistryService,
    private readonly logger: AppLogger,
    private readonly conversations: ConversationRepository,
    private readonly calls: CallAccessService,
  ) {}

  async fanoutDomainEvent(event: { name: string; payload: Record<string, unknown> }): Promise<void> {
    if ([CALL_EVENTS.INITIATED, CALL_EVENTS.ACCEPTED, CALL_EVENTS.CONNECTED, "call.offer", "call.answer", "call.ice"].includes(event.name)) {
      const call = event.payload.call as { id?: unknown } | undefined;
      const callId = typeof event.payload.callId === "string" ? event.payload.callId : call?.id;
      if (typeof callId !== "string" || !(await this.calls.isLive(callId))) return;
    }
    const recipients = normalizeRecipientUserIds(event.payload);
    const conversationId = event.payload.conversationId;
    if (typeof conversationId === "string" && recipients.length > 0 && event.name !== "conversation.closed") {
      // Revalidate after commit: a queued message must not reach a departed/blocked group.
      const allowed = await Promise.all(recipients.map(async (userId) =>
        await this.conversations.findByIdForUser(conversationId, userId) ? userId : null));
      event = { ...event, payload: { ...event.payload, recipientUserIds: allowed.filter((id) => id !== null) } };
    }
    switch (event.name) {
      case "conversation.closed": {
        this.socketRegistryService.emitToUsers(recipients, event.name, { conversationId, status: event.payload.status, closedReason: event.payload.closedReason });
        return;
      }
      case PRESENCE_EVENTS.UPDATED: {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        if (recipientUserIds.length === 0) {
          return;
        }

        this.socketRegistryService.emitToUsers(recipientUserIds, "presence.updated", {
          userId: String(event.payload.userId),
          status: event.payload.status,
          updatedAt: event.payload.updatedAt,
        });
        return;
      }
      case "match.created": {
        const userIds = Array.isArray(event.payload.userIds)
          ? event.payload.userIds.map(String)
          : [];
        const matchByUserId =
          typeof event.payload.matchByUserId === "object" &&
          event.payload.matchByUserId !== null
            ? (event.payload.matchByUserId as Record<string, unknown>)
            : {};

        for (const userId of userIds) {
          const match = matchByUserId[userId];
          if (!match) {
            continue;
          }

          this.socketRegistryService.emitToUsers([userId], "match.created", {
            match,
          });
        }
        return;
      }
      case "duo.plan.updated": {
        this.socketRegistryService.emitToUsers(normalizeRecipientUserIds(event.payload), event.name, { conversationId: event.payload.conversationId, planId: event.payload.planId });
        return;
      }
      case "conversation.message.created":
      case "conversation.message.updated": {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        const messageByUserId =
          typeof event.payload.messageByUserId === "object" &&
          event.payload.messageByUserId !== null
            ? (event.payload.messageByUserId as Record<string, unknown>)
            : {};
        const conversationId = String(event.payload.conversationId);

        for (const userId of recipientUserIds) {
          const message = messageByUserId[userId];
          if (!message) {
            continue;
          }

          this.socketRegistryService.emitToUsers([userId], event.name, {
            conversationId,
            message,
          });
        }
        return;
      }
      case "conversation.message.deleted": {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        if (recipientUserIds.length === 0) {
          return;
        }

        this.socketRegistryService.emitToUsers(recipientUserIds, event.name, {
          conversationId: String(event.payload.conversationId),
          messageId: String(event.payload.messageId),
          sequence: Number(event.payload.sequence),
          status: event.payload.status,
          deletedAt: event.payload.deletedAt,
        });
        return;
      }
      case "conversation.read.updated": {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        if (recipientUserIds.length === 0) {
          return;
        }

        this.socketRegistryService.emitToUsers(recipientUserIds, event.name, {
          conversationId: String(event.payload.conversationId),
          readState: event.payload.readState,
        });
        return;
      }
      case "message.typing": {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        if (recipientUserIds.length === 0) {
          return;
        }

        this.socketRegistryService.emitToUsers(
          recipientUserIds,
          "conversation.typing.updated",
          {
            conversationId: String(event.payload.conversationId),
            userId: String(event.payload.userId),
            isTyping: Boolean(event.payload.isTyping),
            expiresAt: String(event.payload.expiresAt),
          },
        );
        return;
      }
      case "notification.created": {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        if (recipientUserIds.length === 0 || !event.payload.notification) {
          return;
        }

        this.socketRegistryService.emitToUsers(recipientUserIds, event.name, {
          notification: event.payload.notification,
        });
        return;
      }
      case CALL_EVENTS.INITIATED: {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        if (
          recipientUserIds.length === 0 ||
          !event.payload.call ||
          !event.payload.otherUser ||
          !Array.isArray(event.payload.iceServers)
        ) {
          return;
        }

        this.socketRegistryService.emitToUsers(recipientUserIds, "call.ringing", {
          call: event.payload.call,
          otherUser: event.payload.otherUser,
          iceServers: event.payload.iceServers,
        });
        return;
      }
      case CALL_EVENTS.ACCEPTED: {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        const callPayload =
          typeof event.payload.call === "object" && event.payload.call !== null
            ? (event.payload.call as { id?: unknown })
            : null;
        if (recipientUserIds.length === 0 || !event.payload.call) {
          return;
        }

        this.socketRegistryService.emitToUsers(recipientUserIds, "call.accepted", {
          call: event.payload.call,
        });

        if (
          typeof event.payload.receiverUserId === "string" &&
          typeof event.payload.acceptedBySessionId === "string" &&
          typeof callPayload?.id === "string"
        ) {
          this.socketRegistryService.emitToUserExceptSession(
            String(event.payload.receiverUserId),
            String(event.payload.acceptedBySessionId),
            "call.acceptedElsewhere",
            {
              callId: String(callPayload.id),
              acceptedBySessionId: String(event.payload.acceptedBySessionId),
              occurredAt:
                typeof event.payload.occurredAt === "string"
                  ? event.payload.occurredAt
                  : new Date().toISOString(),
            },
          );
        }
        return;
      }
      case CALL_EVENTS.CONNECTED:
      case CALL_EVENTS.ENDED:
      case CALL_EVENTS.MISSED: {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        if (recipientUserIds.length === 0 || !event.payload.call) {
          return;
        }

        const socketEvent =
          event.name === CALL_EVENTS.CONNECTED
            ? "call.connected"
            : event.name === CALL_EVENTS.MISSED
              ? "call.missed"
              : "call.ended";
        this.socketRegistryService.emitToUsers(recipientUserIds, socketEvent, {
          call: event.payload.call,
        });
        return;
      }
      case "call.offer":
      case "call.answer":
      case "call.ice": {
        if (
          typeof event.payload.callId !== "string" ||
          typeof event.payload.signalingVersion !== "number" ||
          typeof event.payload.fromUserId !== "string"
        ) {
          return;
        }

        const payload = {
          callId: String(event.payload.callId),
          signalingVersion: Number(event.payload.signalingVersion),
          fromUserId: String(event.payload.fromUserId),
          ...(event.name === "call.ice"
            ? {
                candidate: event.payload.candidate,
              }
            : {
                sdp: String(event.payload.sdp ?? ""),
              }),
        };

        if (
          typeof event.payload.recipientUserId === "string" &&
          typeof event.payload.recipientSessionId === "string"
        ) {
          this.socketRegistryService.emitToUserSession(
            String(event.payload.recipientUserId),
            String(event.payload.recipientSessionId),
            event.name,
            payload,
          );
          return;
        }

        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        if (recipientUserIds.length === 0) {
          return;
        }

        this.socketRegistryService.emitToUsers(recipientUserIds, event.name, payload);
        return;
      }
      default: {
        this.logger.debug(`Ignoring unhandled realtime domain event ${event.name}`);
      }
    }
  }
}

function normalizeRecipientUserIds(payload: Record<string, unknown>): string[] {
  if (Array.isArray(payload.recipientUserIds)) {
    return payload.recipientUserIds.map(String);
  }
  if (Array.isArray(payload.userIds)) {
    return payload.userIds.map(String);
  }
  if (typeof payload.recipientUserId === "string") {
    return [payload.recipientUserId];
  }
  if (typeof payload.userId === "string") {
    return [payload.userId];
  }

  return [];
}

export function buildWsSystemError(
  error: unknown,
  _clientRequestId?: string,
): WsSystemErrorDto {
  const errorRequestId = randomUUID();
  if (error instanceof AppException) {
    const response = error.getResponse();
    return {
      code: error.code,
      message:
        typeof response === "object" &&
        response !== null &&
        "message" in response
          ? String((response as { message?: string }).message ?? "Request failed")
          : "Request failed",
      requestId: errorRequestId,
      details: error.details ?? {},
    };
  }

  return {
    code: ERROR_CODES.INTERNAL_ERROR,
    message: "Unexpected server error",
    requestId: errorRequestId,
    details: {},
  };
}
