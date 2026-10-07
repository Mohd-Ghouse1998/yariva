import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../integrations/redis/redis.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  CallEndReason,
  CallSession,
  CallSessionStatus,
  CallType,
  Conversation,
  Match,
  MatchCommunicationSetting,
  User,
  UserCommunicationPreference,
} from "../../../generated/prisma/client";

type CallExecutor = PrismaService | PrismaTransactionalClient;

type CallParticipantRecord = Pick<
  User,
  "id" | "status" | "deletedAt" | "isCallFrozen"
> & {
  communicationPreference: Pick<
    UserCommunicationPreference,
    "allowVoiceCalls" | "allowVideoCalls" | "allowPushCalls"
  > | null;
};

export interface MatchCallContext
  extends Pick<Match, "id" | "status" | "userLowId" | "userHighId"> {
  conversation: Pick<Conversation, "id" | "status"> | null;
  communicationSettings: Pick<
    MatchCommunicationSetting,
    "userId" | "allowVoiceCalls" | "allowVideoCalls" | "muted" | "updatedAt"
  >[];
  userLow: CallParticipantRecord;
  userHigh: CallParticipantRecord;
}

export interface CallSessionProjection extends CallSession {
  match: Pick<Match, "id" | "status" | "userLowId" | "userHighId"> & {
    communicationSettings: Pick<
      MatchCommunicationSetting,
      "userId" | "allowVoiceCalls" | "allowVideoCalls" | "muted" | "updatedAt"
    >[];
  };
  conversation: Pick<Conversation, "id" | "status">;
  initiatorUser: CallParticipantRecord;
  receiverUser: CallParticipantRecord;
}

@Injectable()
export class MatchCallContextRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdForUser(
    matchId: string,
    userId: string,
    executor?: CallExecutor,
  ): Promise<MatchCallContext | null> {
    const db = executor ?? this.prisma;

    if (executor && executor !== this.prisma) {
      // Match revocation updates this same row before closing calls. Acquire it
      // before reading permissions so a queued initiation sees the committed state.
      await executor.$executeRaw`SELECT id FROM "Match" WHERE id = ${matchId}::uuid FOR UPDATE`;
    }

    return (db.match.findFirst({
      where: {
        id: matchId,
        OR: [{ userLowId: userId }, { userHighId: userId }],
      },
      include: matchCallContextInclude(),
    })) as Promise<MatchCallContext | null>;
  }
}

@Injectable()
export class CallSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPendingInvitation(userId: string): Promise<CallSessionProjection | null> {
    return this.prisma.callSession.findFirst({
      where: { receiverUserId: userId, status: "RINGING", expiresAt: { gt: new Date() } },
      include: callSessionInclude(), orderBy: { createdAt: "desc" },
    }) as Promise<CallSessionProjection | null>;
  }

  async hasActiveBlockBetween(
    actorId: string,
    targetId: string,
    executor?: CallExecutor,
  ): Promise<boolean> {
    const db = executor ?? this.prisma;
    const count = await db.block.count({
      where: {
        deletedAt: null,
        OR: [
          {
            blockerId: actorId,
            blockedId: targetId,
          },
          {
            blockerId: targetId,
            blockedId: actorId,
          },
        ],
      },
    });

    return count > 0;
  }

  async findActiveConflictForMatch(
    matchId: string,
    executor?: CallExecutor,
  ): Promise<Pick<CallSession, "id" | "status"> | null> {
    const db = executor ?? this.prisma;

    return db.callSession.findFirst({
      where: {
        matchId,
        status: {
          in: ["RINGING", "ACCEPTED", "CONNECTING", "CONNECTED"],
        },
      },
      select: {
        id: true,
        status: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findById(
    callId: string,
    executor?: CallExecutor,
  ): Promise<CallSessionProjection | null> {
    const db = executor ?? this.prisma;

    return (db.callSession.findUnique({
      where: {
        id: callId,
      },
      include: callSessionInclude(),
    })) as Promise<CallSessionProjection | null>;
  }

  async findByIdForUser(
    callId: string,
    userId: string,
    executor?: CallExecutor,
  ): Promise<CallSessionProjection | null> {
    const db = executor ?? this.prisma;

    if (executor && executor !== this.prisma) {
      const subject = await db.callSession.findUnique({ where: { id: callId }, select: { matchId: true } });
      if (subject) {
        await executor.$executeRaw`SELECT id FROM "Match" WHERE id = ${subject.matchId}::uuid FOR UPDATE`;
        await executor.$executeRaw`SELECT id FROM "CallSession" WHERE id = ${callId}::uuid FOR UPDATE`;
      }
    }

    return (db.callSession.findFirst({
      where: {
        id: callId,
        OR: [{ initiatorUserId: userId }, { receiverUserId: userId }],
      },
      include: callSessionInclude(),
    })) as Promise<CallSessionProjection | null>;
  }

  async create(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
      conversationId: string;
      initiatorUserId: string;
      receiverUserId: string;
      callType: CallType;
      purpose?: "STANDARD" | "VOICE_INTRODUCTION";
      introductionPrompt?: string | null;
      initiatorSessionId: string;
      ringStartedAt: Date;
      expiresAt: Date;
    },
  ): Promise<CallSessionProjection> {
    const created = await executor.callSession.create({
      data: {
        matchId: input.matchId,
        conversationId: input.conversationId,
        initiatorUserId: input.initiatorUserId,
        receiverUserId: input.receiverUserId,
        callType: input.callType,
        purpose: input.purpose ?? "STANDARD",
        introductionPrompt: input.introductionPrompt ?? null,
        initiatorSessionId: input.initiatorSessionId,
        ringStartedAt: input.ringStartedAt,
        expiresAt: input.expiresAt,
      },
      select: {
        id: true,
      },
    });

    return (await this.findById(created.id, executor)) as CallSessionProjection;
  }

  async updateStatusIfCurrent(
    executor: PrismaTransactionalClient,
    input: {
      callId: string;
      currentStatuses: CallSessionStatus[];
      data: {
        status: CallSessionStatus;
        acceptedBySessionId?: string | null;
        acceptedAt?: Date | null;
        connectedAt?: Date | null;
        endedAt?: Date | null;
        expiresAt?: Date;
        endedByUserId?: string | null;
        endReason?: CallEndReason | null;
      };
    },
  ): Promise<CallSessionProjection | null> {
    const updated = await executor.callSession.updateMany({
      where: {
        id: input.callId,
        status: {
          in: input.currentStatuses,
        },
      },
      data: input.data,
    });

    if (updated.count === 0) {
      return null;
    }

    return (await this.findById(input.callId, executor)) as CallSessionProjection;
  }

  async listExpiredOpenCalls(
    now: Date,
    limit = 100,
    executor?: CallExecutor,
  ): Promise<CallSessionProjection[]> {
    const db = executor ?? this.prisma;

    return (db.callSession.findMany({
      where: {
        status: {
          in: ["RINGING", "ACCEPTED", "CONNECTING"],
        },
        expiresAt: {
          lte: now,
        },
      },
      include: callSessionInclude(),
      orderBy: {
        expiresAt: "asc",
      },
      take: limit,
    })) as Promise<CallSessionProjection[]>;
  }
}

@Injectable()
export class SignalingStateRepository {
  private static readonly OFFER_KEY_PREFIX = "call:offer:";
  private static readonly ANSWER_KEY_PREFIX = "call:answer:";
  private static readonly RING_ACK_KEY_PREFIX = "call:ring-ack:";
  private static readonly ICE_KEY_PREFIX = "call:ice:";

  constructor(private readonly redis: RedisService) {}

  async markRingAcknowledged(input: {
    callId: string;
    sessionId: string;
    connectionId: string;
    acknowledgedAt: string;
    ttlSeconds: number;
  }): Promise<void> {
    await this.redis
      .multi()
      .hset(
        `${SignalingStateRepository.RING_ACK_KEY_PREFIX}${input.callId}`,
        input.sessionId,
        JSON.stringify({
          connectionId: input.connectionId,
          acknowledgedAt: input.acknowledgedAt,
        }),
      )
      .expire(
        `${SignalingStateRepository.RING_ACK_KEY_PREFIX}${input.callId}`,
        input.ttlSeconds,
      )
      .exec();
  }

  async saveOffer(input: {
    callId: string;
    signalingVersion: number;
    fromUserId: string;
    sdp: string;
    ttlSeconds: number;
  }): Promise<void> {
    await this.redis.set(
      `${SignalingStateRepository.OFFER_KEY_PREFIX}${input.callId}`,
      JSON.stringify(input),
      "EX",
      input.ttlSeconds,
    );
  }

  async saveAnswer(input: {
    callId: string;
    signalingVersion: number;
    fromUserId: string;
    sdp: string;
    ttlSeconds: number;
  }): Promise<void> {
    await this.redis.set(
      `${SignalingStateRepository.ANSWER_KEY_PREFIX}${input.callId}`,
      JSON.stringify(input),
      "EX",
      input.ttlSeconds,
    );
  }

  async appendIce(input: {
    callId: string;
    userId: string;
    signalingVersion: number;
    candidate: {
      candidate: string;
      sdpMid: string | null;
      sdpMLineIndex: number;
      usernameFragment: string | null;
    };
    ttlSeconds: number;
  }): Promise<void> {
    const key = `${SignalingStateRepository.ICE_KEY_PREFIX}${input.callId}:${input.userId}`;
    await this.redis
      .multi()
      .rpush(
        key,
        JSON.stringify({
          signalingVersion: input.signalingVersion,
          candidate: input.candidate,
        }),
      )
      .expire(key, input.ttlSeconds)
      .exec();
  }

  async clear(callId: string, participantUserIds: string[]): Promise<void> {
    const pipeline = this.redis.multi();
    pipeline.del(
      `${SignalingStateRepository.OFFER_KEY_PREFIX}${callId}`,
      `${SignalingStateRepository.ANSWER_KEY_PREFIX}${callId}`,
      `${SignalingStateRepository.RING_ACK_KEY_PREFIX}${callId}`,
    );

    for (const userId of participantUserIds) {
      pipeline.del(`${SignalingStateRepository.ICE_KEY_PREFIX}${callId}:${userId}`);
    }

    await pipeline.exec();
  }
}

function callParticipantSelect() {
  return {
    id: true,
    status: true,
    deletedAt: true,
    isCallFrozen: true,
    communicationPreference: {
      select: {
        allowVoiceCalls: true,
        allowVideoCalls: true,
        allowPushCalls: true,
      },
    },
  };
}

function matchCallContextInclude() {
  return {
    conversation: {
      select: {
        id: true,
        status: true,
      },
    },
    communicationSettings: {
      select: {
        userId: true,
        allowVoiceCalls: true,
        allowVideoCalls: true,
        muted: true,
        updatedAt: true,
      },
    },
    userLow: {
      select: callParticipantSelect(),
    },
    userHigh: {
      select: callParticipantSelect(),
    },
  };
}

function callSessionInclude() {
  return {
    match: {
      select: {
        id: true,
        status: true,
        userLowId: true,
        userHighId: true,
        communicationSettings: {
          select: {
            userId: true,
            allowVoiceCalls: true,
            allowVideoCalls: true,
            muted: true,
            updatedAt: true,
          },
        },
      },
    },
    conversation: {
      select: {
        id: true,
        status: true,
      },
    },
    initiatorUser: {
      select: callParticipantSelect(),
    },
    receiverUser: {
      select: callParticipantSelect(),
    },
  };
}
