import { selectIntroductionPrompt } from "../domain/voice-introduction";
import { Injectable } from "@nestjs/common";
import { BullmqProducer } from "../../../integrations/bullmq/bullmq.producer";
import { TurnCredentialService } from "../../../integrations/rtc/turn-credential.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AppLogger } from "../../../common/logger/app-logger.service";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import { AppException } from "../../../common/errors/app.exception";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { UserRepository } from "../../users/infrastructure/users.infrastructure";
import { MatchReaderService } from "../../matches/application/matches.services";
import { MatchPolicyService } from "../../matches/domain/matches.domain";
import type { PublicProfileDto } from "../../discovery/dto/discovery.dto";
import type {
  AcceptCallResponseDto,
  CallAnswerEventDto,
  CallIceEventDto,
  CallOfferEventDto,
  CallResponseDto,
  CallSessionDto,
  CallTypeValue,
  IceCandidateDto,
  IceServerDto,
  InitiateCallResponseDto,
} from "../dto/calls.dto";
import { CALL_EVENTS } from "../events/calls.events";
import {
  CallPermissionService,
  CallStateMachineService,
} from "../domain/calls.domain";
import {
  CallSessionRepository,
  MatchCallContextRepository,
  SignalingStateRepository,
  type CallSessionProjection,
  type MatchCallContext,
} from "../infrastructure/calls.infrastructure";
import { CallParticipantPolicy } from "../policies/call-participant.policy";

export interface CallActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class CallAccessService {
  constructor(private readonly repository: CallSessionRepository, private readonly permission: CallPermissionService) {}

  async isLive(callId: string): Promise<boolean> {
    const call = await this.repository.findById(callId);
    if (!call) return false;
    try {
      this.permission.assertCallNotTerminal(call.status);
      if (call.status !== "CONNECTED" && call.expiresAt.getTime() <= Date.now()) return false;
      this.permission.assertContinuationAllowed({
        callType: call.callType, matchStatus: call.match.status, conversationStatus: call.conversation.status,
        initiatorUser: call.initiatorUser, receiverUser: call.receiverUser,
        initiatorMatchSetting: resolveMatchSetting(call.match.communicationSettings, call.initiatorUserId),
        receiverMatchSetting: resolveMatchSetting(call.match.communicationSettings, call.receiverUserId),
        hasActiveBlock: await this.repository.hasActiveBlockBetween(call.initiatorUserId, call.receiverUserId),
      });
      return true;
    } catch { return false; }
  }
}

@Injectable()
export class CallSessionReaderService {
  constructor(
    private readonly matchReaderService: MatchReaderService,
    private readonly turnCredentialService: TurnCredentialService,
  ) {}

  mapCall(call: CallSessionProjection): CallSessionDto {
    return {
      id: call.id,
      matchId: call.matchId,
      conversationId: call.conversationId,
      initiatorUserId: call.initiatorUserId,
      receiverUserId: call.receiverUserId,
      callType: call.callType,
      purpose: call.purpose === "VOICE_INTRODUCTION" ? "VOICE_INTRODUCTION" : "STANDARD",
      introductionPrompt: call.introductionPrompt,
      suggestedDurationSeconds: call.purpose === "VOICE_INTRODUCTION" ? this.turnCredentialService.getIntroductionSuggestedSeconds() : null,
      status: call.status,
      signalingVersion: call.signalingVersion,
      ringStartedAt: call.ringStartedAt?.toISOString() ?? null,
      acceptedAt: call.acceptedAt?.toISOString() ?? null,
      connectedAt: call.connectedAt?.toISOString() ?? null,
      endedAt: call.endedAt?.toISOString() ?? null,
      expiresAt: call.expiresAt.toISOString(),
      endReason: call.endReason ?? null,
      createdAt: call.createdAt.toISOString(),
      updatedAt: call.updatedAt.toISOString(),
    };
  }

  getIceServers(): IceServerDto[] {
    return this.turnCredentialService.getIceServers();
  }

  async getOtherUserForViewer(
    matchId: string,
    viewerUserId: string,
  ): Promise<PublicProfileDto> {
    const match = await this.matchReaderService.getRequiredMatch(matchId, viewerUserId);
    return (await this.matchReaderService.mapSummary(match, viewerUserId)).otherUser;
  }
}

@Injectable()
export class CallCleanupSchedulerService {
  constructor(
    private readonly bullmqProducer: BullmqProducer,
    private readonly logger: AppLogger,
  ) {}

  async schedule(
    callId: string,
    delayMs: number,
    phase: "ringing" | "connect",
  ): Promise<void> {
    try {
      await this.bullmqProducer.enqueue(
        "call.cleanup.stale",
        {
          callSessionId: callId,
          phase,
        },
        {
          jobId: `call.cleanup.stale:${callId}:${phase}`,
          delayMs,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue stale call cleanup for ${callId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }
}

@Injectable()
export class InitiateCallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchCallContextRepository: MatchCallContextRepository,
    private readonly callSessionRepository: CallSessionRepository,
    private readonly callPermissionService: CallPermissionService,
    private readonly callSessionReaderService: CallSessionReaderService,
    private readonly callCleanupSchedulerService: CallCleanupSchedulerService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly auditLogService: AuditLogService,
    private readonly userRepository: UserRepository,
    private readonly turnCredentialService: TurnCredentialService,
    private readonly matchPolicyService: MatchPolicyService,
  ) {}

  async execute(input: {
    userId: string;
    sessionId: string;
    payload: {
      matchId: string;
      callType: CallTypeValue;
      purpose?: "STANDARD" | "VOICE_INTRODUCTION";
    };
    metadata: CallActionMetadata;
  }): Promise<InitiateCallResponseDto> {
    const now = new Date();
    const isIntroduction = input.payload.purpose === "VOICE_INTRODUCTION";
    if (isIntroduction && (input.payload.callType !== "VOICE" || !this.turnCredentialService.areVoiceIntroductionsEnabled())) {
      throw new AppException(400, ERROR_CODES.VALIDATION_FAILED, "Voice introductions are not available for this call");
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const lockKey = `call-match:${input.payload.matchId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const context = await this.matchCallContextRepository.findByIdForUser(
        input.payload.matchId,
        input.userId,
        tx,
      );
      this.matchPolicyService.assertReadable(context, input.userId);
      this.matchPolicyService.assertActive(context);
      if (input.payload.callType === "VIDEO" && await tx.blindRelationship.findFirst({ where: { matchId: context.id, revealedAt: null } })) {
        throw new AppException(403, ERROR_CODES.CALL_PERMISSION_DENIED, "Reveal photos together before starting a video call");
      }

      const participants = resolveParticipantsFromMatchContext(context, input.userId);
      const hasActiveBlock =
        await this.callSessionRepository.hasActiveBlockBetween(
          participants.initiator.id,
          participants.receiver.id,
          tx,
        );
      const conflictingCall =
        await this.callSessionRepository.findActiveConflictForMatch(
          context.id,
          tx,
        );

      this.callPermissionService.assertInitiationAllowed({
        callType: input.payload.callType,
        matchStatus: context.status,
        conversationStatus: context.conversation?.status ?? null,
        initiatorUser: participants.initiator,
        receiverUser: participants.receiver,
        initiatorMatchSetting: participants.initiatorMatchSetting,
        receiverMatchSetting: participants.receiverMatchSetting,
        hasActiveBlock,
        conflictingActiveCallId: conflictingCall?.id ?? null,
      });

      if (!context.conversation) {
        throw new AppException(
          409,
          ERROR_CODES.CALL_PERMISSION_DENIED,
          "Call is not allowed by current permissions",
        );
      }

      const scenes = isIntroduction ? await tx.scene.findMany({ where: {
        ownerId: { in: [context.userLowId, context.userHighId] }, status: "ACTIVE", expiresAt: { gt: now },
        owner: { profile: { isHidden: false, isIncognito: false, isPaused: false } },
        AND: [{ OR: [{ availableUntil: null }, { availableUntil: { gt: now } }] }, { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] }],
      }, select: { activityTokens: true, intent: true } }) : [];
      const call = await this.callSessionRepository.create(tx, {
        purpose: isIntroduction ? "VOICE_INTRODUCTION" : "STANDARD",
        introductionPrompt: isIntroduction ? selectIntroductionPrompt(scenes) : null,
        matchId: context.id,
        conversationId: context.conversation.id,
        initiatorUserId: participants.initiator.id,
        receiverUserId: participants.receiver.id,
        callType: input.payload.callType,
        initiatorSessionId: input.sessionId,
        ringStartedAt: now,
        expiresAt: new Date(now.getTime() + this.turnCredentialService.getRingTimeoutMs()),
      });

      await this.userRepository.touchLastActiveAt(input.userId, now, tx);
      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          actorSessionId: input.sessionId,
          action: "call.initiate",
          entityType: "call_session",
          entityId: call.id,
          targetUserId: participants.receiver.id,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            matchId: input.payload.matchId,
            conversationId: context.conversation.id,
            callType: input.payload.callType,
          },
        },
        tx,
      );

      return call;
    });

    const callDto = this.callSessionReaderService.mapCall(result);
    const iceServers = this.callSessionReaderService.getIceServers();
    const otherUser = await this.callSessionReaderService.getOtherUserForViewer(
      result.matchId,
      result.receiverUserId,
    );

    await this.callCleanupSchedulerService.schedule(
      result.id,
      Math.max(result.expiresAt.getTime() - Date.now(), 0),
      "ringing",
    );
    await this.domainEventPublisher.publishSafely(CALL_EVENTS.INITIATED, {
      call: callDto,
      otherUser,
      iceServers,
      recipientUserIds: [result.receiverUserId],
    });

    return {
      call: callDto,
      iceServers,
    };
  }
}

@Injectable()
export class AcceptCallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly callSessionRepository: CallSessionRepository,
    private readonly callPermissionService: CallPermissionService,
    private readonly callSessionReaderService: CallSessionReaderService,
    private readonly callCleanupSchedulerService: CallCleanupSchedulerService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly auditLogService: AuditLogService,
    private readonly userRepository: UserRepository,
    private readonly turnCredentialService: TurnCredentialService,
    private readonly callParticipantPolicy: CallParticipantPolicy,
  ) {}

  async execute(input: {
    userId: string;
    sessionId: string;
    callId: string;
    metadata: CallActionMetadata;
  }): Promise<AcceptCallResponseDto> {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.callSessionRepository.findByIdForUser(
        input.callId,
        input.userId,
        tx,
      );
      this.callParticipantPolicy.assertParticipant(input.userId, current);
      this.callParticipantPolicy.assertReceiver(input.userId, current.receiverUserId);
      if (current.status !== "CONNECTED" && current.expiresAt.getTime() <= now.getTime()) {
        throw new AppException(409, ERROR_CODES.CALL_NOT_RINGING, "This call invitation has expired");
      }

      const hasActiveBlock =
        await this.callSessionRepository.hasActiveBlockBetween(
          current.initiatorUserId,
          current.receiverUserId,
          tx,
        );
      this.callPermissionService.assertContinuationAllowed({
        callType: current.callType,
        matchStatus: current.match.status,
        conversationStatus: current.conversation.status,
        initiatorUser: current.initiatorUser,
        receiverUser: current.receiverUser,
        initiatorMatchSetting: resolveMatchSetting(
          current.match.communicationSettings,
          current.initiatorUserId,
        ),
        receiverMatchSetting: resolveMatchSetting(
          current.match.communicationSettings,
          current.receiverUserId,
        ),
        hasActiveBlock,
      });

      if (current.acceptedBySessionId === input.sessionId && ["ACCEPTED", "CONNECTING", "CONNECTED"].includes(current.status)) return current;
      this.callPermissionService.assertRinging(current.status);

      const accepted = await this.callSessionRepository.updateStatusIfCurrent(tx, {
        callId: input.callId,
        currentStatuses: ["RINGING"],
        data: {
          status: "ACCEPTED",
          acceptedBySessionId: input.sessionId,
          acceptedAt: now,
          expiresAt: new Date(
            now.getTime() + this.turnCredentialService.getConnectTimeoutMs(),
          ),
        },
      });

      if (!accepted) {
        const latest = await this.callSessionRepository.findById(input.callId, tx);
        this.callParticipantPolicy.assertParticipant(input.userId, latest);

        if (
          latest.acceptedBySessionId &&
          latest.acceptedBySessionId !== input.sessionId
        ) {
          throw new AppException(
            409,
            ERROR_CODES.CALL_ALREADY_ACCEPTED,
            "Another device already accepted the call",
          );
        }

        if (
          latest.acceptedBySessionId === input.sessionId &&
          (latest.status === "ACCEPTED" ||
            latest.status === "CONNECTING" ||
            latest.status === "CONNECTED")
        ) {
          return latest;
        }

        this.callPermissionService.assertRinging(latest.status);
      }

      const call = accepted ?? (await this.callSessionRepository.findById(input.callId, tx));
      this.callParticipantPolicy.assertParticipant(input.userId, call);

      await this.userRepository.touchLastActiveAt(input.userId, now, tx);
      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          actorSessionId: input.sessionId,
          action: "call.accept",
          entityType: "call_session",
          entityId: call.id,
          targetUserId: call.initiatorUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            matchId: call.matchId,
            conversationId: call.conversationId,
          },
        },
        tx,
      );

      return call;
    });

    const callDto = this.callSessionReaderService.mapCall(result);
    const iceServers = this.callSessionReaderService.getIceServers();

    await this.callCleanupSchedulerService.schedule(
      result.id,
      Math.max(result.expiresAt.getTime() - Date.now(), 0),
      "connect",
    );
    await this.domainEventPublisher.publishSafely(CALL_EVENTS.ACCEPTED, {
      call: callDto,
      recipientUserIds: [result.initiatorUserId, result.receiverUserId],
      receiverUserId: result.receiverUserId,
      acceptedBySessionId: result.acceptedBySessionId,
      occurredAt: result.acceptedAt?.toISOString() ?? new Date().toISOString(),
    });

    return {
      call: callDto,
      iceServers,
    };
  }
}

@Injectable()
export class DeclineCallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly callSessionRepository: CallSessionRepository,
    private readonly callPermissionService: CallPermissionService,
    private readonly callSessionReaderService: CallSessionReaderService,
    private readonly signalingStateRepository: SignalingStateRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly auditLogService: AuditLogService,
    private readonly userRepository: UserRepository,
    private readonly callParticipantPolicy: CallParticipantPolicy,
  ) {}

  async execute(input: {
    userId: string;
    sessionId: string;
    callId: string;
    metadata: CallActionMetadata;
  }): Promise<CallResponseDto> {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.callSessionRepository.findByIdForUser(
        input.callId,
        input.userId,
        tx,
      );
      this.callParticipantPolicy.assertParticipant(input.userId, current);
      this.callParticipantPolicy.assertReceiver(input.userId, current.receiverUserId);
      this.callPermissionService.assertRinging(current.status);

      const declined = await this.callSessionRepository.updateStatusIfCurrent(tx, {
        callId: input.callId,
        currentStatuses: ["RINGING"],
        data: {
          status: "DECLINED",
          endedAt: now,
          endedByUserId: input.userId,
          endReason: "DECLINED",
        },
      });

      if (!declined) {
        const latest = await this.callSessionRepository.findById(input.callId, tx);
        this.callParticipantPolicy.assertParticipant(input.userId, latest);
        if (
          latest.status === "ACCEPTED" ||
          latest.status === "CONNECTING" ||
          latest.status === "CONNECTED"
        ) {
          throw new AppException(
            409,
            ERROR_CODES.CALL_ALREADY_ACCEPTED,
            "Another device already accepted the call",
          );
        }
        this.callPermissionService.assertRinging(latest.status);
      }

      const call = declined ?? (await this.callSessionRepository.findById(input.callId, tx));
      this.callParticipantPolicy.assertParticipant(input.userId, call);

      await this.userRepository.touchLastActiveAt(input.userId, now, tx);
      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          actorSessionId: input.sessionId,
          action: "call.decline",
          entityType: "call_session",
          entityId: call.id,
          targetUserId: call.initiatorUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            matchId: call.matchId,
            conversationId: call.conversationId,
          },
        },
        tx,
      );

      return call;
    });

    await this.signalingStateRepository.clear(result.id, [
      result.initiatorUserId,
      result.receiverUserId,
    ]);
    await this.domainEventPublisher.publishSafely(CALL_EVENTS.ENDED, {
      call: this.callSessionReaderService.mapCall(result),
      recipientUserIds: [result.initiatorUserId, result.receiverUserId],
    });

    return {
      call: this.callSessionReaderService.mapCall(result),
    };
  }
}

@Injectable()
export class EndCallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly callSessionRepository: CallSessionRepository,
    private readonly callPermissionService: CallPermissionService,
    private readonly callStateMachineService: CallStateMachineService,
    private readonly callSessionReaderService: CallSessionReaderService,
    private readonly signalingStateRepository: SignalingStateRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly auditLogService: AuditLogService,
    private readonly userRepository: UserRepository,
    private readonly callParticipantPolicy: CallParticipantPolicy,
  ) {}

  async execute(input: {
    userId: string;
    sessionId: string;
    callId: string;
    payload: {
      reason: "HANGUP";
    };
    metadata: CallActionMetadata;
  }): Promise<CallResponseDto> {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.callSessionRepository.findByIdForUser(
        input.callId,
        input.userId,
        tx,
      );
      this.callParticipantPolicy.assertParticipant(input.userId, current);
      const transition = this.callStateMachineService.resolveEndTransition({
        status: current.status,
        actorIsInitiator: current.initiatorUserId === input.userId,
      });

      const updated = await this.callSessionRepository.updateStatusIfCurrent(tx, {
        callId: input.callId,
        currentStatuses: [current.status],
        data: {
          status: transition.nextStatus,
          endedAt: now,
          endedByUserId: input.userId,
          endReason: transition.endReason,
        },
      });

      if (!updated) {
        const latest = await this.callSessionRepository.findById(input.callId, tx);
        this.callParticipantPolicy.assertParticipant(input.userId, latest);
        throw new AppException(
          409,
          ERROR_CODES.CALL_NOT_ACTIVE,
          "Call is no longer active",
        );
      }

      await this.userRepository.touchLastActiveAt(input.userId, now, tx);
      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          actorSessionId: input.sessionId,
          action: "call.end",
          entityType: "call_session",
          entityId: updated.id,
          targetUserId: this.callParticipantPolicy.resolveOtherUserId(
            updated,
            input.userId,
          ),
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            reason: input.payload.reason,
            status: updated.status,
            matchId: updated.matchId,
            conversationId: updated.conversationId,
          },
        },
        tx,
      );

      return updated;
    });

    await this.signalingStateRepository.clear(result.id, [
      result.initiatorUserId,
      result.receiverUserId,
    ]);
    await this.domainEventPublisher.publishSafely(CALL_EVENTS.ENDED, {
      call: this.callSessionReaderService.mapCall(result),
      recipientUserIds: [result.initiatorUserId, result.receiverUserId],
    });

    return {
      call: this.callSessionReaderService.mapCall(result),
    };
  }
}

@Injectable()
export class RelaySignalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly callSessionRepository: CallSessionRepository,
    private readonly signalingStateRepository: SignalingStateRepository,
    private readonly callPermissionService: CallPermissionService,
    private readonly callStateMachineService: CallStateMachineService,
    private readonly callParticipantPolicy: CallParticipantPolicy,
    private readonly callSessionReaderService: CallSessionReaderService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly userRepository: UserRepository,
    private readonly turnCredentialService: TurnCredentialService,
  ) {}

  async recordRingAck(input: {
    callId: string;
    userId: string;
    sessionId: string;
    connectionId: string;
  }): Promise<void> {
    const call = await this.callSessionRepository.findByIdForUser(
      input.callId,
      input.userId,
    );
    this.callParticipantPolicy.assertParticipant(input.userId, call);
    this.callPermissionService.assertCallNotTerminal(call.status);
    this.callPermissionService.assertValidSignalDirection({
      status: call.status,
      initiatorUserId: call.initiatorUserId,
      receiverUserId: call.receiverUserId,
      acceptedBySessionId: call.acceptedBySessionId,
      userId: input.userId,
      sessionId: input.sessionId,
      signalType: "ring.ack",
    });

    await this.userRepository.touchLastActiveAt(input.userId, new Date());
    await this.signalingStateRepository.markRingAcknowledged({
      callId: input.callId,
      sessionId: input.sessionId,
      connectionId: input.connectionId,
      acknowledgedAt: new Date().toISOString(),
      ttlSeconds: this.turnCredentialService.getSignalTtlSeconds(),
    });
  }

  async relayOffer(input: {
    callId: string;
    userId: string;
    sessionId: string;
    signalingVersion: number;
    sdp: string;
  }): Promise<void> {
    const call = await this.getValidatedSignalCall(input, "offer");
    await this.signalingStateRepository.saveOffer({
      callId: call.id,
      signalingVersion: input.signalingVersion,
      fromUserId: input.userId,
      sdp: input.sdp,
      ttlSeconds: this.turnCredentialService.getSignalTtlSeconds(),
    });

    if (call.status === "ACCEPTED") {
      await this.prisma.$transaction(async (tx) => {
        await this.callSessionRepository.updateStatusIfCurrent(tx, {
          callId: call.id,
          currentStatuses: ["ACCEPTED"],
          data: {
            status: "CONNECTING",
          },
        });
      });
    }

    await this.userRepository.touchLastActiveAt(input.userId, new Date());
    const target = resolveSignalTarget(call, input.userId);

    await this.domainEventPublisher.publish("call.offer", {
      callId: call.id,
      signalingVersion: input.signalingVersion,
      fromUserId: input.userId,
      sdp: input.sdp,
      recipientUserId: target.userId,
      recipientSessionId: target.sessionId,
    } satisfies CallOfferEventDto & {
      recipientUserId: string;
      recipientSessionId: string | null;
    });
  }

  async relayAnswer(input: {
    callId: string;
    userId: string;
    sessionId: string;
    signalingVersion: number;
    sdp: string;
  }): Promise<void> {
    const call = await this.getValidatedSignalCall(input, "answer");
    await this.signalingStateRepository.saveAnswer({
      callId: call.id,
      signalingVersion: input.signalingVersion,
      fromUserId: input.userId,
      sdp: input.sdp,
      ttlSeconds: this.turnCredentialService.getSignalTtlSeconds(),
    });

    const now = new Date();
    const connected = await this.prisma.$transaction(async (tx) =>
      this.callSessionRepository.updateStatusIfCurrent(tx, {
        callId: call.id,
        currentStatuses: ["ACCEPTED", "CONNECTING"],
        data: {
          status: "CONNECTED",
          connectedAt: now,
        },
      }),
    );
    const latest =
      connected ?? (await this.callSessionRepository.findById(call.id)) ?? call;

    await this.userRepository.touchLastActiveAt(input.userId, now);
    const target = resolveSignalTarget(latest, input.userId);

    await this.domainEventPublisher.publish("call.answer", {
      callId: latest.id,
      signalingVersion: input.signalingVersion,
      fromUserId: input.userId,
      sdp: input.sdp,
      recipientUserId: target.userId,
      recipientSessionId: target.sessionId,
    } satisfies CallAnswerEventDto & {
      recipientUserId: string;
      recipientSessionId: string | null;
    });

    if (connected) {
      await this.domainEventPublisher.publishSafely(CALL_EVENTS.CONNECTED, {
        call: this.callSessionReaderService.mapCall(latest),
        recipientUserIds: [latest.initiatorUserId, latest.receiverUserId],
      });
    }
  }

  async relayIce(input: {
    callId: string;
    userId: string;
    sessionId: string;
    signalingVersion: number;
    candidate: IceCandidateDto;
  }): Promise<void> {
    const call = await this.getValidatedSignalCall(input, "ice");
    await this.signalingStateRepository.appendIce({
      callId: call.id,
      userId: input.userId,
      signalingVersion: input.signalingVersion,
      candidate: {
        candidate: input.candidate.candidate,
        sdpMid: input.candidate.sdpMid ?? null,
        sdpMLineIndex: input.candidate.sdpMLineIndex,
        usernameFragment: input.candidate.usernameFragment ?? null,
      },
      ttlSeconds: this.turnCredentialService.getSignalTtlSeconds(),
    });

    if (call.status === "ACCEPTED") {
      await this.prisma.$transaction(async (tx) => {
        await this.callSessionRepository.updateStatusIfCurrent(tx, {
          callId: call.id,
          currentStatuses: ["ACCEPTED"],
          data: {
            status: "CONNECTING",
          },
        });
      });
    }

    await this.userRepository.touchLastActiveAt(input.userId, new Date());
    const target = resolveSignalTarget(call, input.userId);

    await this.domainEventPublisher.publish("call.ice", {
      callId: call.id,
      signalingVersion: input.signalingVersion,
      fromUserId: input.userId,
      candidate: {
        candidate: input.candidate.candidate,
        sdpMid: input.candidate.sdpMid ?? null,
        sdpMLineIndex: input.candidate.sdpMLineIndex,
        usernameFragment: input.candidate.usernameFragment ?? null,
      },
      recipientUserId: target.userId,
      recipientSessionId: target.sessionId,
    } satisfies CallIceEventDto & {
      recipientUserId: string;
      recipientSessionId: string | null;
    });
  }

  private async getValidatedSignalCall(
    input: {
      callId: string;
      userId: string;
      sessionId: string;
      signalingVersion: number;
    },
    signalType: "offer" | "answer" | "ice",
  ): Promise<CallSessionProjection> {
    const call = await this.callSessionRepository.findByIdForUser(
      input.callId,
      input.userId,
    );
    this.callParticipantPolicy.assertParticipant(input.userId, call);
    this.callPermissionService.assertCallNotTerminal(call.status);
    this.callPermissionService.assertValidSignalDirection({
      status: call.status,
      initiatorUserId: call.initiatorUserId,
      receiverUserId: call.receiverUserId,
      acceptedBySessionId: call.acceptedBySessionId,
      userId: input.userId,
      sessionId: input.sessionId,
      signalType,
    });
    this.callPermissionService.assertSignalingVersion(
      call.signalingVersion,
      input.signalingVersion,
    );

    const hasActiveBlock = await this.callSessionRepository.hasActiveBlockBetween(
      call.initiatorUserId,
      call.receiverUserId,
    );
    this.callPermissionService.assertContinuationAllowed({
      callType: call.callType,
      matchStatus: call.match.status,
      conversationStatus: call.conversation.status,
      initiatorUser: call.initiatorUser,
      receiverUser: call.receiverUser,
      initiatorMatchSetting: resolveMatchSetting(
        call.match.communicationSettings,
        call.initiatorUserId,
      ),
      receiverMatchSetting: resolveMatchSetting(
        call.match.communicationSettings,
        call.receiverUserId,
      ),
      hasActiveBlock,
    });

    return call;
  }
}

@Injectable()
export class CallCleanupStaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly callSessionRepository: CallSessionRepository,
    private readonly callStateMachineService: CallStateMachineService,
    private readonly callSessionReaderService: CallSessionReaderService,
    private readonly signalingStateRepository: SignalingStateRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input?: {
    callId?: string;
    now?: Date;
  }): Promise<void> {
    const now = input?.now ?? new Date();
    const calls = input?.callId
      ? await this.loadSingleCall(input.callId)
      : await this.callSessionRepository.listExpiredOpenCalls(now);

    for (const current of calls) {
      if (current.expiresAt.getTime() > now.getTime()) {
        continue;
      }

      const transition = this.callStateMachineService.resolveCleanupTransition(
        current.status,
      );
      if (!transition) {
        continue;
      }

      const updated = await this.prisma.$transaction(async (tx) =>
        this.callSessionRepository.updateStatusIfCurrent(tx, {
          callId: current.id,
          currentStatuses: [current.status],
          data: {
            status: transition.nextStatus,
            endedAt: now,
            endedByUserId: null,
            endReason: transition.endReason,
          },
        }),
      );

      if (!updated) {
        continue;
      }

      await this.signalingStateRepository.clear(updated.id, [
        updated.initiatorUserId,
        updated.receiverUserId,
      ]);

      if (updated.status === "MISSED") {
        await this.domainEventPublisher.publishSafely(CALL_EVENTS.MISSED, {
          call: this.callSessionReaderService.mapCall(updated),
          recipientUserIds: [updated.initiatorUserId, updated.receiverUserId],
        });
      } else {
        await this.domainEventPublisher.publishSafely(CALL_EVENTS.ENDED, {
          call: this.callSessionReaderService.mapCall(updated),
          recipientUserIds: [updated.initiatorUserId, updated.receiverUserId],
        });
      }
    }
  }

  private async loadSingleCall(callId: string): Promise<CallSessionProjection[]> {
    const call = await this.callSessionRepository.findById(callId);
    return call ? [call] : [];
  }
}

function resolveParticipantsFromMatchContext(
  context: MatchCallContext,
  initiatorUserId: string,
): {
  initiator: MatchCallContext["userLow"] | MatchCallContext["userHigh"];
  receiver: MatchCallContext["userLow"] | MatchCallContext["userHigh"];
  initiatorMatchSetting: MatchCallContext["communicationSettings"][number] | null;
  receiverMatchSetting: MatchCallContext["communicationSettings"][number] | null;
} {
  const initiator =
    context.userLow.id === initiatorUserId ? context.userLow : context.userHigh;
  const receiver =
    context.userLow.id === initiatorUserId ? context.userHigh : context.userLow;

  return {
    initiator,
    receiver,
    initiatorMatchSetting: resolveMatchSetting(
      context.communicationSettings,
      initiator.id,
    ),
    receiverMatchSetting: resolveMatchSetting(
      context.communicationSettings,
      receiver.id,
    ),
  };
}

function resolveMatchSetting(
  settings: Array<{
    userId: string;
    allowVoiceCalls: boolean;
    allowVideoCalls: boolean;
    muted: boolean;
    updatedAt: Date;
  }>,
  userId: string,
): (typeof settings)[number] | null {
  return settings.find((setting) => setting.userId === userId) ?? null;
}

function resolveSignalTarget(
  call: Pick<
    CallSessionProjection,
    "initiatorUserId" | "receiverUserId" | "initiatorSessionId" | "acceptedBySessionId" | "status"
  >,
  senderUserId: string,
): {
  userId: string;
  sessionId: string | null;
} {
  if (senderUserId === call.initiatorUserId) {
    return {
      userId: call.receiverUserId,
      sessionId: call.acceptedBySessionId ?? null,
    };
  }

  return {
    userId: call.initiatorUserId,
    sessionId: call.initiatorSessionId ?? null,
  };
}
