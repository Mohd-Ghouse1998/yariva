import { Injectable } from "@nestjs/common";
import { mediaPairKey } from "../../../integrations/object-storage/media-disclosure.service";
import { DuoRevocationService } from "../../conversations/application/duo-revocation.service";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { Block, Prisma } from "../../../generated/prisma/client";
import { CALL_EVENTS } from "../../calls/events/calls.events";
import { CONVERSATION_EVENTS } from "../../conversations/events/conversations.events";
import { MATCH_EVENTS } from "../../matches/events/matches.events";
import { BLOCK_EVENTS } from "../events/block.events";
import type {
  BlockDto,
  BlockPageDto,
  BlockResponseDto,
  CreateBlockDto,
} from "../dto/blocks.dto";
import { BlockPolicyService } from "../domain/blocks.domain";
import {
  BlockCascadeRepository,
  BlockCascadeResult,
  BlockRepository,
} from "../infrastructure/blocks.infrastructure";

export interface BlockActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class ListBlocksService {
  constructor(private readonly blockRepository: BlockRepository) {}

  async execute(input: {
    blockerId: string;
    cursor?: string;
    limit?: number;
  }): Promise<BlockPageDto> {
    const page = await this.blockRepository.listByBlocker({
      blockerId: input.blockerId,
      cursor: input.cursor,
      limit: input.limit ?? 20,
    });

    return {
      items: page.items.map(mapBlock),
      nextCursor: page.nextCursor,
    };
  }
}

@Injectable()
export class CreateBlockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockRepository: BlockRepository,
    private readonly cascadeRepository: BlockCascadeRepository,
    private readonly policy: BlockPolicyService,
    private readonly auditLogService: AuditLogService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly duoRevocation: DuoRevocationService,
  ) {}

  async execute(input: {
    actor: AuthContext;
    payload: CreateBlockDto;
    metadata: BlockActionMetadata;
  }): Promise<BlockResponseDto> {
    this.policy.assertCanBlock(input.actor.user.id, input.payload.blockedUserId);
    await this.assertBlockedUserExists(input.payload.blockedUserId);

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${mediaPairKey(input.actor.user.id, input.payload.blockedUserId)}, 0))`;
      const block = await this.blockRepository.createOrReactivate(tx, {
        blockerId: input.actor.user.id,
        blockedId: input.payload.blockedUserId,
        reason: input.payload.reason ?? null,
      });

      const cascade = await this.cascadeRepository.applyCascade(tx, {
        blockerId: input.actor.user.id,
        blockedId: input.payload.blockedUserId,
        now,
      });

      await this.auditLogService.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "block.create",
          entityType: "Block",
          entityId: block.id,
          targetUserId: input.payload.blockedUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: summarizeCascade(cascade) as Prisma.InputJsonValue,
        },
        tx,
      );

      return { block, cascade };
    });

    await this.publishCascadeEvents(input.actor.user.id, result.cascade);
    await this.duoRevocation.publishClosed({ AND: [input.actor.user.id, input.payload.blockedUserId].map(userId => ({ members: { some: { userId } } })) });
    await this.domainEventPublisher.publishSafely(BLOCK_EVENTS.CREATED, {
      block: mapBlock(result.block),
      blockerId: result.block.blockerId,
      blockedId: result.block.blockedId,
      recipientUserIds: [result.block.blockerId],
    });

    return { block: mapBlock(result.block) };
  }

  private async assertBlockedUserExists(blockedUserId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: blockedUserId },
      select: { id: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new AppException(
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "Blocked user not found",
      );
    }
  }

  private async publishCascadeEvents(
    blockerId: string,
    cascade: BlockCascadeResult,
  ): Promise<void> {
    if (cascade.match) {
      await this.domainEventPublisher.publishSafely(MATCH_EVENTS.ENDED, {
        matchId: cascade.match.id,
        endedReason: "BLOCKED",
        endedByUserId: blockerId,
        recipientUserIds: [cascade.match.userLowId, cascade.match.userHighId],
      });
    }

    if (cascade.conversation) {
      await this.domainEventPublisher.publishSafely(CONVERSATION_EVENTS.CLOSED, {
        conversationId: cascade.conversation.id,
        status: cascade.conversation.status,
        closedReason: cascade.conversation.closedReason,
        recipientUserIds: cascade.match
          ? [cascade.match.userLowId, cascade.match.userHighId]
          : [],
      });
    }

    for (const call of cascade.calls) {
      await this.domainEventPublisher.publishSafely(CALL_EVENTS.ENDED, {
        call: {
          id: call.id,
          matchId: call.matchId,
          conversationId: call.conversationId,
          initiatorUserId: call.initiatorUserId,
          receiverUserId: call.receiverUserId,
          callType: call.callType,
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
        },
        recipientUserIds: [call.initiatorUserId, call.receiverUserId],
      });
    }
  }
}

@Injectable()
export class RemoveBlockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockRepository: BlockRepository,
    private readonly auditLogService: AuditLogService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: {
    actor: AuthContext;
    blockedUserId: string;
    metadata: BlockActionMetadata;
  }): Promise<void> {
    const now = new Date();
    const removedCount = await this.prisma.$transaction(async (tx) => {
      const count = await this.blockRepository.remove(tx, {
        blockerId: input.actor.user.id,
        blockedId: input.blockedUserId,
        now,
      });

      await this.auditLogService.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "block.remove",
          entityType: "Block",
          entityId: null,
          targetUserId: input.blockedUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: { removedCount: count },
        },
        tx,
      );

      return count;
    });

    if (removedCount === 0) {
      return;
    }

    await this.domainEventPublisher.publishSafely(BLOCK_EVENTS.REMOVED, {
      blockerId: input.actor.user.id,
      blockedId: input.blockedUserId,
      recipientUserIds: [input.actor.user.id],
    });
  }
}

export function mapBlock(block: Block): BlockDto {
  return {
    id: block.id,
    blockerId: block.blockerId,
    blockedId: block.blockedId,
    reason: block.reason,
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString(),
  };
}

function summarizeCascade(cascade: BlockCascadeResult): Record<string, unknown> {
  return {
    matchEnded: Boolean(cascade.match),
    conversationClosed: Boolean(cascade.conversation),
    callsEnded: cascade.calls.length,
    datePlansCancelled: cascade.cancelledDatePlans,
  };
}
