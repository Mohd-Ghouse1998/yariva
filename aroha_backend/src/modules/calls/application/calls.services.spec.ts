import { AppException } from "../../../common/errors/app.exception";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { MatchPolicyService } from "../../matches/domain/matches.domain";
import { CALL_EVENTS } from "../events/calls.events";
import {
  CallPermissionService,
  CallStateMachineService,
} from "../domain/calls.domain";
import { CallParticipantPolicy } from "../policies/call-participant.policy";
import {
  AcceptCallService,
  CallCleanupStaleService,
  DeclineCallService,
  EndCallService,
  InitiateCallService,
  RelaySignalService,
} from "./calls.services";

describe("CallPermissionService", () => {
  const service = new CallPermissionService();

  const baseInput = {
    callType: "VOICE" as const,
    matchStatus: "ACTIVE" as const,
    conversationStatus: "ACTIVE" as const,
    initiatorUser: {
      id: "user-1",
      status: "ACTIVE" as const,
      deletedAt: null,
      isCallFrozen: false,
      communicationPreference: {
        allowVoiceCalls: true,
        allowVideoCalls: true,
        allowPushCalls: true,
      },
    },
    receiverUser: {
      id: "user-2",
      status: "ACTIVE" as const,
      deletedAt: null,
      isCallFrozen: false,
      communicationPreference: {
        allowVoiceCalls: true,
        allowVideoCalls: true,
        allowPushCalls: true,
      },
    },
    initiatorMatchSetting: {
      allowVoiceCalls: true,
      allowVideoCalls: true,
    },
    receiverMatchSetting: {
      allowVoiceCalls: true,
      allowVideoCalls: true,
    },
    hasActiveBlock: false,
  };

  it("denies initiation when an active block exists", () => {
    expect(() =>
      service.assertInitiationAllowed({
        ...baseInput,
        hasActiveBlock: true,
        conflictingActiveCallId: null,
      }),
    ).toThrow(AppException);

    try {
      service.assertInitiationAllowed({
        ...baseInput,
        hasActiveBlock: true,
        conflictingActiveCallId: null,
      });
    } catch (error) {
      expect((error as AppException).code).toBe(ERROR_CODES.CALL_PERMISSION_DENIED);
    }
  });

  it("denies initiation when the receiver disabled the call type globally", () => {
    expect(() =>
      service.assertInitiationAllowed({
        ...baseInput,
        receiverUser: {
          ...baseInput.receiverUser,
          communicationPreference: {
            allowVoiceCalls: false,
            allowVideoCalls: true,
            allowPushCalls: true,
          },
        },
        conflictingActiveCallId: null,
      }),
    ).toThrow(AppException);
  });

  it("rejects stale signaling versions", () => {
    expect(() => service.assertSignalingVersion(2, 1)).toThrow(AppException);
  });
});

describe("InitiateCallService", () => {
  it("creates a ringing call, schedules cleanup, and publishes the ring event", async () => {
    const createdCall = buildCallProjection();
    const service = new InitiateCallService(
      {
        $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({ $executeRaw: jest.fn().mockResolvedValue(1) }),
        ),
      } as never,
      {
        findByIdForUser: jest.fn().mockResolvedValue(buildMatchContext()),
      } as never,
      {
        hasActiveBlockBetween: jest.fn().mockResolvedValue(false),
        findActiveConflictForMatch: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdCall),
      } as never,
      new CallPermissionService(),
      {
        mapCall: jest.fn().mockReturnValue({ id: "call-1", status: "RINGING" }),
        getIceServers: jest.fn().mockReturnValue([{ urls: ["stun:example.org:3478"] }]),
        getOtherUserForViewer: jest.fn().mockResolvedValue({ userId: "user-1" }),
      } as never,
      {
        schedule: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        publishSafely: jest.fn().mockResolvedValue(true),
      } as never,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        touchLastActiveAt: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        getRingTimeoutMs: jest.fn().mockReturnValue(30_000),
      } as never,
      new MatchPolicyService(),
    );

    const result = await service.execute({
      userId: "user-1",
      sessionId: "session-1",
      payload: {
        matchId: "match-1",
        callType: "VOICE",
      },
      metadata: {
        ipAddress: "203.0.113.1",
        userAgent: "aroha-tests/1.0",
      },
    });

    expect(result.call.id).toBe("call-1");
    expect((service as any).callCleanupSchedulerService.schedule).toHaveBeenCalledWith(
      "call-1",
      expect.any(Number),
      "ringing",
    );
    expect((service as any).domainEventPublisher.publishSafely).toHaveBeenCalledWith(
      CALL_EVENTS.INITIATED,
      expect.objectContaining({
        recipientUserIds: ["user-2"],
      }),
    );
  });
});

describe("AcceptCallService", () => {
  it("returns the accepted call for the winning receiver session", async () => {
    const acceptedCall = buildCallProjection({
      status: "ACCEPTED",
      acceptedBySessionId: "session-2",
      acceptedAt: new Date("2026-04-26T10:05:00.000Z"),
    });
    const service = new AcceptCallService(
      {
        $transaction: jest.fn(async (callback: (tx: Record<string, never>) => Promise<unknown>) =>
          callback({}),
        ),
      } as never,
      {
        findByIdForUser: jest.fn().mockResolvedValue(buildCallProjection()),
        hasActiveBlockBetween: jest.fn().mockResolvedValue(false),
        updateStatusIfCurrent: jest.fn().mockResolvedValue(acceptedCall),
      } as never,
      new CallPermissionService(),
      {
        mapCall: jest.fn().mockReturnValue({ id: "call-1", status: "ACCEPTED" }),
        getIceServers: jest.fn().mockReturnValue([{ urls: ["stun:example.org:3478"] }]),
      } as never,
      {
        schedule: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        publishSafely: jest.fn().mockResolvedValue(true),
      } as never,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        touchLastActiveAt: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        getConnectTimeoutMs: jest.fn().mockReturnValue(60_000),
      } as never,
      new CallParticipantPolicy(),
    );

    const result = await service.execute({
      userId: "user-2",
      sessionId: "session-2",
      callId: "call-1",
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(result.call.status).toBe("ACCEPTED");
  });

  it("rejects a second receiver session after another device has already accepted", async () => {
    const service = new AcceptCallService(
      {
        $transaction: jest.fn(async (callback: (tx: Record<string, never>) => Promise<unknown>) =>
          callback({}),
        ),
      } as never,
      {
        findByIdForUser: jest.fn().mockResolvedValue(buildCallProjection()),
        hasActiveBlockBetween: jest.fn().mockResolvedValue(false),
        updateStatusIfCurrent: jest.fn().mockResolvedValue(null),
        findById: jest.fn().mockResolvedValue(
          buildCallProjection({
            status: "ACCEPTED",
            acceptedBySessionId: "session-accepted",
            acceptedAt: new Date("2026-04-26T10:05:00.000Z"),
          }),
        ),
      } as never,
      new CallPermissionService(),
      {
        mapCall: jest.fn(),
        getIceServers: jest.fn(),
      } as never,
      {
        schedule: jest.fn(),
      } as never,
      {
        publishSafely: jest.fn(),
      } as never,
      {
        write: jest.fn(),
      } as never,
      {
        touchLastActiveAt: jest.fn(),
      } as never,
      {
        getConnectTimeoutMs: jest.fn().mockReturnValue(60_000),
      } as never,
      new CallParticipantPolicy(),
    );

    await expect(
      service.execute({
        userId: "user-2",
        sessionId: "session-late",
        callId: "call-1",
        metadata: {
          ipAddress: null,
          userAgent: null,
        },
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.CALL_ALREADY_ACCEPTED,
    });
  });
});

describe("DeclineCallService", () => {
  it("transitions a ringing call to DECLINED", async () => {
    const declinedCall = buildCallProjection({
      status: "DECLINED",
      endReason: "DECLINED",
      endedAt: new Date("2026-04-26T10:06:00.000Z"),
    });
    const service = new DeclineCallService(
      {
        $transaction: jest.fn(async (callback: (tx: Record<string, never>) => Promise<unknown>) =>
          callback({}),
        ),
      } as never,
      {
        findByIdForUser: jest.fn().mockResolvedValue(buildCallProjection()),
        updateStatusIfCurrent: jest.fn().mockResolvedValue(declinedCall),
      } as never,
      new CallPermissionService(),
      {
        mapCall: jest.fn().mockReturnValue({ id: "call-1", status: "DECLINED" }),
      } as never,
      {
        clear: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        publishSafely: jest.fn().mockResolvedValue(true),
      } as never,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        touchLastActiveAt: jest.fn().mockResolvedValue(undefined),
      } as never,
      new CallParticipantPolicy(),
    );

    const result = await service.execute({
      userId: "user-2",
      sessionId: "session-2",
      callId: "call-1",
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(result.call.status).toBe("DECLINED");
  });
});

describe("EndCallService", () => {
  it("ends a connected call with HANGUP", async () => {
    const endedCall = buildCallProjection({
      status: "ENDED",
      endReason: "HANGUP",
      endedAt: new Date("2026-04-26T10:07:00.000Z"),
    });
    const service = new EndCallService(
      {
        $transaction: jest.fn(async (callback: (tx: Record<string, never>) => Promise<unknown>) =>
          callback({}),
        ),
      } as never,
      {
        findByIdForUser: jest.fn().mockResolvedValue(
          buildCallProjection({
            status: "CONNECTED",
            connectedAt: new Date("2026-04-26T10:06:30.000Z"),
          }),
        ),
        updateStatusIfCurrent: jest.fn().mockResolvedValue(endedCall),
      } as never,
      new CallPermissionService(),
      new CallStateMachineService(),
      {
        mapCall: jest.fn().mockReturnValue({ id: "call-1", status: "ENDED" }),
      } as never,
      {
        clear: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        publishSafely: jest.fn().mockResolvedValue(true),
      } as never,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        touchLastActiveAt: jest.fn().mockResolvedValue(undefined),
      } as never,
      new CallParticipantPolicy(),
    );

    const result = await service.execute({
      userId: "user-1",
      sessionId: "session-1",
      callId: "call-1",
      payload: {
        reason: "HANGUP",
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(result.call.status).toBe("ENDED");
  });
});

describe("RelaySignalService", () => {
  it("rejects stale signaling versions", async () => {
    const service = buildRelaySignalService({
      findByIdForUser: jest.fn().mockResolvedValue(
        buildCallProjection({
          signalingVersion: 2,
          status: "ACCEPTED",
          acceptedBySessionId: "session-2",
        }),
      ),
    });

    await expect(
      service.relayAnswer({
        callId: "call-1",
        userId: "user-2",
        sessionId: "session-2",
        signalingVersion: 1,
        sdp: "answer-sdp",
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.CALL_STALE_SIGNAL,
    });
  });

  it("publishes relayed call.offer events", async () => {
    const service = buildRelaySignalService({
      findByIdForUser: jest.fn().mockResolvedValue(buildCallProjection()),
    });

    await service.relayOffer({
      callId: "call-1",
      userId: "user-1",
      sessionId: "session-1",
      signalingVersion: 1,
      sdp: "offer-sdp",
    });

    expect((service as any).domainEventPublisher.publish).toHaveBeenCalledWith(
      "call.offer",
      expect.objectContaining({
        callId: "call-1",
        fromUserId: "user-1",
        recipientUserId: "user-2",
      }),
    );
  });

  it("publishes call.answer and call.connected after the accepted receiver answers", async () => {
    const service = buildRelaySignalService({
      findByIdForUser: jest.fn().mockResolvedValue(
        buildCallProjection({
          status: "ACCEPTED",
          acceptedBySessionId: "session-2",
        }),
      ),
      findById: jest.fn().mockResolvedValue(
        buildCallProjection({
          status: "CONNECTED",
          acceptedBySessionId: "session-2",
          connectedAt: new Date("2026-04-26T10:08:00.000Z"),
        }),
      ),
      updateStatusIfCurrent: jest.fn().mockResolvedValue(
        buildCallProjection({
          status: "CONNECTED",
          acceptedBySessionId: "session-2",
          connectedAt: new Date("2026-04-26T10:08:00.000Z"),
        }),
      ),
    });

    await service.relayAnswer({
      callId: "call-1",
      userId: "user-2",
      sessionId: "session-2",
      signalingVersion: 1,
      sdp: "answer-sdp",
    });

    expect((service as any).domainEventPublisher.publish).toHaveBeenCalledWith(
      "call.answer",
      expect.objectContaining({
        recipientUserId: "user-1",
        recipientSessionId: "session-1",
      }),
    );
    expect((service as any).domainEventPublisher.publishSafely).toHaveBeenCalledWith(
      CALL_EVENTS.CONNECTED,
      expect.objectContaining({
        recipientUserIds: ["user-1", "user-2"],
      }),
    );
  });

  it("publishes relayed call.ice events", async () => {
    const service = buildRelaySignalService({
      findByIdForUser: jest.fn().mockResolvedValue(buildCallProjection()),
    });

    await service.relayIce({
      callId: "call-1",
      userId: "user-1",
      sessionId: "session-1",
      signalingVersion: 1,
      candidate: {
        candidate: "candidate:1 1 UDP 1 203.0.113.1 3478 typ host",
        sdpMid: "0",
        sdpMLineIndex: 0,
        usernameFragment: "ufrag",
      },
    });

    expect((service as any).domainEventPublisher.publish).toHaveBeenCalledWith(
      "call.ice",
      expect.objectContaining({
        recipientUserId: "user-2",
      }),
    );
  });
});

describe("CallCleanupStaleService", () => {
  it("marks expired ringing calls missed and expired accepted calls timed out", async () => {
    const service = new CallCleanupStaleService(
      {
        $transaction: jest.fn(async (callback: (tx: Record<string, never>) => Promise<unknown>) =>
          callback({}),
        ),
      } as never,
      {
        listExpiredOpenCalls: jest.fn().mockResolvedValue([
          buildCallProjection({
            id: "call-missed",
            status: "RINGING",
            expiresAt: new Date("2026-04-26T10:00:00.000Z"),
          }),
          buildCallProjection({
            id: "call-timeout",
            status: "ACCEPTED",
            acceptedBySessionId: "session-2",
            expiresAt: new Date("2026-04-26T10:00:00.000Z"),
          }),
        ]),
        updateStatusIfCurrent: jest
          .fn()
          .mockResolvedValueOnce(
            buildCallProjection({
              id: "call-missed",
              status: "MISSED",
              endReason: "MISSED",
              endedAt: new Date("2026-04-26T10:01:00.000Z"),
            }),
          )
          .mockResolvedValueOnce(
            buildCallProjection({
              id: "call-timeout",
              status: "TIMED_OUT",
              endReason: "TIMEOUT",
              endedAt: new Date("2026-04-26T10:01:00.000Z"),
            }),
          ),
      } as never,
      new CallStateMachineService(),
      {
        mapCall: jest
          .fn()
          .mockReturnValueOnce({ id: "call-missed", status: "MISSED" })
          .mockReturnValueOnce({ id: "call-timeout", status: "TIMED_OUT" }),
      } as never,
      {
        clear: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        publishSafely: jest.fn().mockResolvedValue(true),
      } as never,
    );

    await service.execute({
      now: new Date("2026-04-26T10:01:00.000Z"),
    });

    expect((service as any).domainEventPublisher.publishSafely).toHaveBeenNthCalledWith(
      1,
      CALL_EVENTS.MISSED,
      expect.objectContaining({
        recipientUserIds: ["user-1", "user-2"],
      }),
    );
    expect((service as any).domainEventPublisher.publishSafely).toHaveBeenNthCalledWith(
      2,
      CALL_EVENTS.ENDED,
      expect.objectContaining({
        recipientUserIds: ["user-1", "user-2"],
      }),
    );
  });
});

function buildRelaySignalService(
  callSessionRepositoryOverrides: Record<string, unknown>,
): RelaySignalService {
  return new RelaySignalService(
    {
      $transaction: jest.fn(async (callback: (tx: Record<string, never>) => Promise<unknown>) =>
        callback({}),
      ),
    } as never,
    {
      hasActiveBlockBetween: jest.fn().mockResolvedValue(false),
      ...callSessionRepositoryOverrides,
    } as never,
    {
      markRingAcknowledged: jest.fn().mockResolvedValue(undefined),
      saveOffer: jest.fn().mockResolvedValue(undefined),
      saveAnswer: jest.fn().mockResolvedValue(undefined),
      appendIce: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    } as never,
    new CallPermissionService(),
    new CallStateMachineService(),
    new CallParticipantPolicy(),
    {
      mapCall: jest.fn().mockReturnValue({ id: "call-1", status: "CONNECTED" }),
    } as never,
    {
      publish: jest.fn().mockResolvedValue(undefined),
      publishSafely: jest.fn().mockResolvedValue(true),
    } as never,
    {
      touchLastActiveAt: jest.fn().mockResolvedValue(undefined),
    } as never,
    {
      getSignalTtlSeconds: jest.fn().mockReturnValue(120),
    } as never,
  );
}

function buildMatchContext(overrides: Record<string, unknown> = {}) {
  return {
    id: "match-1",
    status: "ACTIVE",
    userLowId: "user-1",
    userHighId: "user-2",
    conversation: {
      id: "conversation-1",
      status: "ACTIVE",
    },
    communicationSettings: [
      {
        userId: "user-1",
        allowVoiceCalls: true,
        allowVideoCalls: true,
        muted: false,
        updatedAt: new Date("2026-04-26T10:00:00.000Z"),
      },
      {
        userId: "user-2",
        allowVoiceCalls: true,
        allowVideoCalls: true,
        muted: false,
        updatedAt: new Date("2026-04-26T10:00:00.000Z"),
      },
    ],
    userLow: buildParticipant("user-1"),
    userHigh: buildParticipant("user-2"),
    ...overrides,
  };
}

function buildCallProjection(overrides: Record<string, unknown> = {}) {
  return {
    id: "call-1",
    matchId: "match-1",
    conversationId: "conversation-1",
    initiatorUserId: "user-1",
    receiverUserId: "user-2",
    callType: "VOICE",
    status: "RINGING",
    signalingVersion: 1,
    initiatorSessionId: "session-1",
    acceptedBySessionId: null,
    ringStartedAt: new Date("2026-04-26T10:00:00.000Z"),
    acceptedAt: null,
    connectedAt: null,
    endedAt: null,
    expiresAt: new Date(Date.now() + 30_000),
    endedByUserId: null,
    endReason: null,
    createdAt: new Date("2026-04-26T10:00:00.000Z"),
    updatedAt: new Date("2026-04-26T10:00:00.000Z"),
    match: {
      id: "match-1",
      status: "ACTIVE",
      userLowId: "user-1",
      userHighId: "user-2",
      communicationSettings: [
        {
          userId: "user-1",
          allowVoiceCalls: true,
          allowVideoCalls: true,
          muted: false,
          updatedAt: new Date("2026-04-26T10:00:00.000Z"),
        },
        {
          userId: "user-2",
          allowVoiceCalls: true,
          allowVideoCalls: true,
          muted: false,
          updatedAt: new Date("2026-04-26T10:00:00.000Z"),
        },
      ],
    },
    conversation: {
      id: "conversation-1",
      status: "ACTIVE",
    },
    initiatorUser: buildParticipant("user-1"),
    receiverUser: buildParticipant("user-2"),
    ...overrides,
  };
}

function buildParticipant(userId: string) {
  return {
    id: userId,
    status: "ACTIVE",
    deletedAt: null,
    isCallFrozen: false,
    communicationPreference: {
      allowVoiceCalls: true,
      allowVideoCalls: true,
      allowPushCalls: true,
    },
  };
}
