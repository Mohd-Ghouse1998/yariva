import { Injectable } from "@nestjs/common";
import { decodeDateIdCursor, encodeDateIdCursor } from "../../../common/utils/cursor.util";
import { canonicalUserPair } from "../../../common/utils/pair.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { Block, CallSession, Conversation, Match } from "../../../generated/prisma/client";

export interface BlockCascadeResult {
  match: Match | null;
  conversation: Conversation | null;
  calls: CallSession[];
  cancelledDatePlans: number;
}

@Injectable()
export class BlockRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByBlocker(input: {
    blockerId: string;
    cursor?: string;
    limit: number;
  }): Promise<{ items: Block[]; nextCursor: string | null }> {
    const cursor = input.cursor ? decodeDateIdCursor(input.cursor) : null;
    const items = await this.prisma.block.findMany({
      where: {
        blockerId: input.blockerId,
        deletedAt: null,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                {
                  createdAt: new Date(cursor.createdAt),
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });

    const hasMore = items.length > input.limit;
    const pageItems = hasMore ? items.slice(0, input.limit) : items;
    const lastItem = pageItems.at(-1);
    return {
      items: pageItems,
      nextCursor:
        hasMore && lastItem
          ? encodeDateIdCursor({
              createdAt: lastItem.createdAt.toISOString(),
              id: lastItem.id,
            })
          : null,
    };
  }

  async findActive(
    blockerId: string,
    blockedId: string,
  ): Promise<Block | null> {
    return this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
  }

  async createOrReactivate(
    executor: PrismaTransactionalClient,
    input: {
      blockerId: string;
      blockedId: string;
      reason: string | null;
    },
  ): Promise<Block> {
    return executor.block.upsert({
      where: {
        blockerId_blockedId: {
          blockerId: input.blockerId,
          blockedId: input.blockedId,
        },
      },
      create: {
        blockerId: input.blockerId,
        blockedId: input.blockedId,
        reason: input.reason,
      },
      update: {
        reason: input.reason,
        deletedAt: null,
      },
    });
  }

  async remove(
    executor: PrismaTransactionalClient,
    input: { blockerId: string; blockedId: string; now: Date },
  ): Promise<number> {
    const result = await executor.block.updateMany({
      where: {
        blockerId: input.blockerId,
        blockedId: input.blockedId,
        deletedAt: null,
      },
      data: { deletedAt: input.now },
    });

    return result.count;
  }
}

@Injectable()
export class BlockCascadeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async applyCascade(
    executor: PrismaTransactionalClient,
    input: {
      blockerId: string;
      blockedId: string;
      now: Date;
    },
  ): Promise<BlockCascadeResult> {
    const pair = canonicalUserPair(input.blockerId, input.blockedId);
    const match = await executor.match.findUnique({
      where: { userLowId_userHighId: pair },
    });

    let updatedMatch: Match | null = null;
    let updatedConversation: Conversation | null = null;
    let updatedCalls: CallSession[] = [];
    let cancelledDatePlans = 0;

    if (match?.status === "ACTIVE") {
      updatedMatch = await executor.match.update({
        where: { id: match.id },
        data: {
          status: "ENDED",
          endedAt: input.now,
          endedReason: "BLOCKED",
          endedByUserId: input.blockerId,
        },
      });
    }

    if (match) {
      const cancelled = await executor.datePlan.updateMany({
        where: {
          matchId: match.id,
          status: { in: ["DRAFT", "PROPOSED", "COUNTERED", "ACCEPTED"] },
        },
        data: { status: "CANCELLED", cancelledAt: input.now },
      });
      cancelledDatePlans = cancelled.count;

      const conversation = await executor.conversation.findUnique({
        where: { matchId: match.id },
      });
      if (conversation && conversation.status === "ACTIVE") {
        updatedConversation = await executor.conversation.update({
          where: { id: conversation.id },
          data: {
            status: "BLOCKED",
            closedAt: input.now,
            closedReason: "BLOCKED",
          },
        });
      }

      const openCalls = await executor.callSession.findMany({
        where: {
          matchId: match.id,
          status: { in: ["RINGING", "ACCEPTED", "CONNECTING", "CONNECTED"] },
        },
      });
      for (const call of openCalls) {
        updatedCalls.push(
          await executor.callSession.update({
            where: { id: call.id },
            data: {
              status: "ENDED",
              endedAt: input.now,
              endedByUserId: input.blockerId,
              endReason: "BLOCKED",
            },
          }),
        );
      }
    }

    return {
      match: updatedMatch,
      conversation: updatedConversation,
      calls: updatedCalls,
      cancelledDatePlans,
    };
  }
}
