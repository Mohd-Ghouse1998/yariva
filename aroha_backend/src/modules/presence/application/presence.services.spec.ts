import { AppException } from "../../../common/errors/app.exception";
import {
  buildWsSystemError,
  ConversationTypingStateService,
  HeartbeatPresenceService,
  PresenceRealtimeFanoutService,
} from "./presence.services";
import { PresencePolicyService } from "../domain/presence.domain";

describe("HeartbeatPresenceService", () => {
  it("refreshes connection presence and session lastSeen for valid heartbeats", async () => {
    const socketRegistryRepository = {
      refreshHeartbeat: jest.fn().mockResolvedValue({
        connectionId: "connection-1",
        socketId: "socket-1",
        userId: "user-1",
        sessionId: "session-1",
        connectedAt: "2026-04-20T10:00:00.000Z",
        lastHeartbeatAt: "2026-04-20T10:01:00.000Z",
      }),
    };
    const presenceRepository = {
      markOnline: jest.fn().mockResolvedValue(undefined),
    };
    const sessionRepository = {
      touchLastSeen: jest.fn().mockResolvedValue(undefined),
    };
    const userRepository = {
      touchLastActiveAt: jest.fn().mockResolvedValue(undefined),
    };

    const service = new HeartbeatPresenceService(
      new PresencePolicyService(),
      socketRegistryRepository as never,
      presenceRepository as never,
      sessionRepository as never,
      userRepository as never,
    );

    await service.execute({
      connectionId: "connection-1",
      sessionId: "session-1",
      status: "ONLINE",
    });

    expect(socketRegistryRepository.refreshHeartbeat).toHaveBeenCalledTimes(1);
    expect(presenceRepository.markOnline).toHaveBeenCalledTimes(1);
    expect(sessionRepository.touchLastSeen).toHaveBeenCalledWith(
      "session-1",
      expect.any(Date),
    );
    expect(userRepository.touchLastActiveAt).toHaveBeenCalledWith(
      "user-1",
      expect.any(Date),
    );
  });

  it("rejects heartbeats from mismatched sessions", async () => {
    const service = new HeartbeatPresenceService(
      new PresencePolicyService(),
      {
        refreshHeartbeat: jest.fn().mockResolvedValue({
          connectionId: "connection-1",
          socketId: "socket-1",
          userId: "user-1",
          sessionId: "session-2",
          connectedAt: "2026-04-20T10:00:00.000Z",
          lastHeartbeatAt: "2026-04-20T10:01:00.000Z",
        }),
      } as never,
      { markOnline: jest.fn() } as never,
      { touchLastSeen: jest.fn() } as never,
      { touchLastActiveAt: jest.fn() } as never,
    );

    await expect(
      service.execute({
        connectionId: "connection-1",
        sessionId: "session-1",
        status: "ONLINE",
      }),
    ).rejects.toBeInstanceOf(AppException);
  });
});

describe("PresenceRealtimeFanoutService", () => {
  it("drops queued call invitations and signaling when access has been revoked", async () => {
    const sockets = { emitToUsers: jest.fn(), emitToUserSession: jest.fn() };
    const service = new PresenceRealtimeFanoutService(sockets as never, {} as never, {} as never, { isLive: jest.fn().mockResolvedValue(false) } as never);
    await service.fanoutDomainEvent({ name: "call.initiated", payload: { call: { id: "call-1" }, recipientUserIds: ["user-2"], otherUser: {}, iceServers: [] } });
    await service.fanoutDomainEvent({ name: "call.offer", payload: { callId: "call-1", recipientUserId: "user-2", recipientSessionId: "session-2", fromUserId: "user-1", signalingVersion: 1, sdp: "private-signal" } });
    expect(sockets.emitToUsers).not.toHaveBeenCalled();
    expect(sockets.emitToUserSession).not.toHaveBeenCalled();
  });
  it("fans out conversation.read.updated only to the intended recipients", async () => {
    const socketRegistryService = {
      emitToUsers: jest.fn(),
      emitToUserExceptSession: jest.fn(),
    };
    const service = new PresenceRealtimeFanoutService(
      socketRegistryService as never,
      { debug: jest.fn() } as never,
      { findByIdForUser: jest.fn().mockResolvedValue({ id: "conversation-1" }) } as never,
      { isLive: jest.fn().mockResolvedValue(true) } as never,
    );

    await service.fanoutDomainEvent({
      name: "conversation.read.updated",
      payload: {
        conversationId: "conversation-1",
        readState: {
          conversationId: "conversation-1",
          userId: "user-1",
          lastReadMessageId: "message-9",
          lastReadSequence: 9,
          lastReadAt: "2026-04-20T10:05:00.000Z",
        },
        recipientUserIds: ["user-1", "user-2"],
      },
    });

    expect(socketRegistryService.emitToUsers).toHaveBeenCalledWith(
      ["user-1", "user-2"],
      "conversation.read.updated",
      {
        conversationId: "conversation-1",
        readState: {
          conversationId: "conversation-1",
          userId: "user-1",
          lastReadMessageId: "message-9",
          lastReadSequence: 9,
          lastReadAt: "2026-04-20T10:05:00.000Z",
        },
      },
    );
  });

  it("emits call.accepted and call.acceptedElsewhere for receiver devices that did not win", async () => {
    const socketRegistryService = {
      emitToUsers: jest.fn(),
      emitToUserExceptSession: jest.fn(),
    };
    const service = new PresenceRealtimeFanoutService(
      socketRegistryService as never,
      { debug: jest.fn() } as never,
      {} as never,
      { isLive: jest.fn().mockResolvedValue(true) } as never,
    );

    await service.fanoutDomainEvent({
      name: "call.accepted",
      payload: {
        call: {
          id: "call-1",
          status: "ACCEPTED",
        },
        recipientUserIds: ["user-1", "user-2"],
        receiverUserId: "user-2",
        acceptedBySessionId: "session-2",
        occurredAt: "2026-04-26T10:05:00.000Z",
      },
    });

    expect(socketRegistryService.emitToUsers).toHaveBeenCalledWith(
      ["user-1", "user-2"],
      "call.accepted",
      {
        call: {
          id: "call-1",
          status: "ACCEPTED",
        },
      },
    );
    expect(socketRegistryService.emitToUserExceptSession).toHaveBeenCalledWith(
      "user-2",
      "session-2",
      "call.acceptedElsewhere",
      {
        callId: "call-1",
        acceptedBySessionId: "session-2",
        occurredAt: "2026-04-26T10:05:00.000Z",
      },
    );
  });
});

describe("ConversationTypingStateService", () => {
  it("emits a final typing stop with the stored recipient list when a socket disconnects", async () => {
    const service = new ConversationTypingStateService(
      {
        clearConnection: jest.fn().mockResolvedValue([
          {
            conversationId: "conversation-1",
            userId: "user-1",
            recipientUserIds: ["user-2"],
          },
        ]),
        countTypingConnections: jest.fn().mockResolvedValue(0),
      } as never,
      {
        publishSafely: jest.fn().mockResolvedValue(true),
      } as never,
    );

    await service.clearConnection("connection-1");

    expect((service as any).domainEventPublisher.publishSafely).toHaveBeenCalledWith(
      "message.typing",
      expect.objectContaining({
        conversationId: "conversation-1",
        userId: "user-1",
        recipientUserIds: ["user-2"],
        isTyping: false,
      }),
    );
  });
});

describe("buildWsSystemError", () => {
  it("always generates a UUID error.requestId instead of echoing the client request id", () => {
    const result = buildWsSystemError(
      new AppException(400, "VALIDATION_FAILED", "Invalid websocket payload"),
      "client-request-id",
    );

    expect(result.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.requestId).not.toBe("client-request-id");
  });
});
