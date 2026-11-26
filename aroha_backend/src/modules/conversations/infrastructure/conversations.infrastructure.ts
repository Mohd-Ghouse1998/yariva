import { Injectable } from "@nestjs/common";
import { Buffer } from "node:buffer";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { decodeScopedCursor, encodeScopedCursor } from "../../../common/utils/scoped-cursor.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  Conversation,
  Prisma,
  ConversationRead,
  Match,
  Message,
  ProfilePhoto,
  User,
  UserInterest,
  UserIntent,
  UserLifestyle,
  UserProfile,
} from "../../../generated/prisma/client";

import { canReadActiveCircleChat, circleChatRosterAllowed } from "../../social/circle-access";

type ConversationExecutor = PrismaService | PrismaTransactionalClient;

export type ConversationProjection = Prisma.ConversationGetPayload<{
  include: ReturnType<typeof conversationInclude>;
}>;

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assertMediaSharingAllowed(matchId: string | null, executor: ConversationExecutor = this.prisma): Promise<void> {
    if (matchId && await executor.blindRelationship.findFirst({ where: { matchId, revealedAt: null } })) {
      throw new AppException(409, ERROR_CODES.VALIDATION_FAILED, "Reveal photos together before sharing attachments");
    }
  }

  async listByUser(
    userId: string,
    input: {
      cursor?: string;
      limit: number;
    },
  ): Promise<{
    items: ConversationProjection[];
    nextCursor: string | null;
  }> {
    const cursor = input.cursor ? decodeConversationCursor(input.cursor) : null;
    const items = (await this.prisma.conversation.findMany({
      where: {
        OR: [
          { match: { OR: [{ userLowId: userId }, { userHighId: userId }] } },
          { duoMatchId: { not: null }, members: { some: { userId } } },
          { circle: { status: "OPEN", expiresAt: { gt: new Date() } }, status: "ACTIVE", members: { some: { userId } } },
        ],
        ...(cursor
          ? {
              AND: [{ OR: [
                {
                  updatedAt: {
                    lt: new Date(cursor.updatedAt),
                  },
                },
                {
                  updatedAt: new Date(cursor.updatedAt),
                  id: {
                    lt: cursor.id,
                  },
                },
              ] }],
            }
          : {}),
      },
      include: conversationInclude(userId),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    })) as unknown as ConversationProjection[];

    const hasMore = items.length > input.limit;
    const pageItems = hasMore ? items.slice(0, input.limit) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: (await Promise.all(pageItems.map(async (item) =>
        await this.isGroupAccessible(item, userId, this.prisma) ? item : null,
      ))).filter((item): item is ConversationProjection => item !== null),
      nextCursor:
        hasMore && lastItem
          ? encodeConversationCursor({
              updatedAt: lastItem.updatedAt.toISOString(),
              id: lastItem.id,
            })
          : null,
    };
  }

  async findByIdForUser(
    conversationId: string,
    userId: string,
    executor?: ConversationExecutor,
  ): Promise<ConversationProjection | null> {
    const db = executor ?? this.prisma;
    if (executor) await lockConversationForMutation(executor, conversationId);

    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { match: { OR: [{ userLowId: userId }, { userHighId: userId }] } },
          { duoMatchId: { not: null }, members: { some: { userId } } },
          { circle: { status: "OPEN", expiresAt: { gt: new Date() } }, status: "ACTIVE", members: { some: { userId } } },
        ],
      },
      include: conversationInclude(userId),
    });
    return conversation && await this.isGroupAccessible(conversation, userId, db) ? conversation : null;
  }

  async findCurrentCircleChatForMember(previousId: string, userId: string): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.conversation.findFirst({
        where: { id: previousId, circleId: { not: null }, status: "CLOSED_UNMATCHED" },
        select: { circleId: true, members: { where: { userId }, select: { circleChatGrantId: true } } },
      });
      const grant = previous?.members[0]?.circleChatGrantId;
      if (!previous?.circleId || !grant) return null;
      await tx.$queryRaw`SELECT id FROM "Circle" WHERE id = ${previous.circleId}::uuid FOR UPDATE`;
      const next = await tx.conversation.findFirst({
        where: { circleId: previous.circleId, status: "ACTIVE", members: { some: { userId, circleChatGrantId: grant } } },
        select: { id: true },
      });
      if (!next) return null;
      return (await this.findByIdForUser(next.id, userId, tx))?.id ?? null;
    });
  }

  async findRetiredCircleChatForUser(id: string, userId: string): Promise<ConversationProjection | null> {
    const chat = await this.prisma.conversation.findFirst({
      where: { id, circleId: { not: null }, status: "CLOSED_UNMATCHED", closedAt: { not: null }, members: { some: { userId } } },
      include: conversationInclude(userId),
    });
    if (!chat?.circle) return null;
    const active = await this.prisma.conversation.findFirst({
      where: { circleId: chat.circle.id, status: "ACTIVE" }, include: conversationInclude(userId),
    });
    const grant = active?.members.find((member) => member.userId === userId)?.circleChatGrantId;
    if (!active || !grant || !chat.members.some((member) => member.userId === userId && member.circleChatGrantId === grant) ||
        !await this.isGroupAccessible(active, userId, this.prisma) ||
        !await circleChatRosterAllowed(this.prisma, chat.members.map((member) => member.userId), chat.circle.intent)) return null;
    return chat;
  }

  async listCircleChatHistory(activeId: string, userId: string, cursorValue?: string) {
    let active = await this.findByIdForUser(activeId, userId);
    if (!active) {
      const currentId = await this.findCurrentCircleChatForMember(activeId, userId);
      if (currentId) active = await this.findByIdForUser(currentId, userId);
    }
    if (!active?.circle) return null;
    const grant = active.members.find((member) => member.userId === userId)?.circleChatGrantId;
    if (!grant) return { items: [], nextCursor: null };
    const scope = `circle-history:${active.circle.id}:${userId}`;
    const cursor = cursorValue ? decodeScopedCursor(cursorValue, scope) : null;
    const pageSize = 12;
    const rows = await this.prisma.conversation.findMany({
      where: {
        circleId: active.circle.id, status: "CLOSED_UNMATCHED", closedAt: { not: null }, lastMessageSequence: { gt: 0 },
        members: { some: { userId, circleChatGrantId: grant } },
        ...(cursor ? { OR: [{ closedAt: { lt: cursor.createdAt } }, { closedAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}),
      },
      select: { id: true, createdAt: true, closedAt: true, members: { select: { userId: true } } },
      orderBy: [{ closedAt: "desc" }, { id: "desc" }], take: pageSize + 1,
    });
    const page = rows.slice(0, pageSize);
    const items = await Promise.all(page.map(async ({ id, createdAt, closedAt, members }) =>
      await circleChatRosterAllowed(this.prisma, members.map((member) => member.userId), active.circle!.intent) ?
        { id, createdAt: createdAt.toISOString(), closedAt: closedAt!.toISOString() } : null));
    const last = page.at(-1);
    return {
      items: items.filter((item) => item !== null),
      nextCursor: last?.closedAt && rows.length > pageSize ? encodeScopedCursor({ id: last.id, createdAt: last.closedAt }, scope) : null,
    };
  }

  private async isGroupAccessible(conversation: ConversationProjection, userId: string, db: ConversationExecutor): Promise<boolean> {
    if (conversation.circle) return canReadActiveCircleChat(db, { ...conversation, circle: conversation.circle }, userId);
    if (!conversation.duoMatch) return true;
    const group = conversation.duoMatch;
    const members = conversation.members;
    if (conversation.status !== "ACTIVE" || group.status !== "ACTIVE" || members.length !== 4 ||
        !members.some((member) => member.userId === userId) ||
        group.partyLow.status !== "ACTIVE" || group.partyHigh.status !== "ACTIVE" ||
        group.partyLow.membershipVersion !== group.partyLowMembershipVersion ||
        group.partyHigh.membershipVersion !== group.partyHighMembershipVersion ||
        members.some((member) => member.user.deletedAt || member.user.status !== "ACTIVE")) return false;
    const ids = members.map((member) => member.userId);
    return await db.block.count({ where: { deletedAt: null, blockerId: { in: ids }, blockedId: { in: ids } } }) === 0;
  }

  async upsertForMatch(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
    },
  ): Promise<Conversation> {
    return executor.conversation.upsert({
      where: {
        matchId: input.matchId,
      },
      create: {
        matchId: input.matchId,
      },
      update: {},
    });
  }

  async closeForMatch(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
      status: "BLOCKED" | "CLOSED_UNMATCHED" | "CLOSED_MODERATION";
      closedReason: "BLOCKED" | "UNMATCHED" | "MODERATION" | "ACCOUNT_DELETED";
      closedAt: Date;
    },
  ): Promise<Conversation | null> {
    const existing = await executor.conversation.findUnique({
      where: {
        matchId: input.matchId,
      },
    });

    if (!existing) {
      return null;
    }

    return executor.conversation.update({
      where: {
        matchId: input.matchId,
      },
      data: {
        status: input.status,
        closedAt: input.closedAt,
        closedReason: input.closedReason,
      },
    });
  }

  async advanceForNewMessage(
    executor: PrismaTransactionalClient,
    input: {
      conversationId: string;
      lastMessagePreview: string | null;
      lastMessageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SYSTEM";
      lastMessageSentAt: Date;
      lastSenderId: string;
    },
  ): Promise<Pick<Conversation, "id" | "lastMessageSequence">> {
    return executor.conversation.update({
      where: {
        id: input.conversationId,
      },
      data: {
        lastMessageSequence: {
          increment: 1,
        },
        lastMessagePreview: input.lastMessagePreview,
        lastMessageType: input.lastMessageType,
        lastMessageSentAt: input.lastMessageSentAt,
        lastSenderId: input.lastSenderId,
      },
      select: {
        id: true,
        lastMessageSequence: true,
      },
    });
  }

  async updateSummary(
    executor: PrismaTransactionalClient,
    input: {
      conversationId: string;
      lastMessagePreview: string | null;
      lastMessageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SYSTEM" | null;
      lastMessageSentAt: Date | null;
      lastSenderId: string | null;
    },
  ): Promise<void> {
    await executor.conversation.update({
      where: {
        id: input.conversationId,
      },
      data: {
        lastMessagePreview: input.lastMessagePreview,
        lastMessageType: input.lastMessageType,
        lastMessageSentAt: input.lastMessageSentAt,
        lastSenderId: input.lastSenderId,
      },
    });
  }
}

/** Party locks always precede the conversation row: leave/block use the same order. */
export async function lockConversationForMutation(
  tx: PrismaTransactionalClient,
  conversationId: string,
): Promise<void> {
  const subject = await tx.conversation.findUnique({
    where: { id: conversationId },
    select: { circleId: true, duoMatch: { select: { partyLowId: true, partyHighId: true } } },
  });
  if (subject?.duoMatch) {
    for (const id of [subject.duoMatch.partyLowId, subject.duoMatch.partyHighId].sort()) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
    }
  }
  if (subject?.circleId) {
    await tx.$queryRaw`SELECT id FROM "Circle" WHERE id = ${subject.circleId}::uuid FOR UPDATE`;
  }
  await tx.$queryRaw`SELECT id FROM "Conversation" WHERE id = ${conversationId}::uuid FOR UPDATE`;
}

@Injectable()
export class ConversationReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertParticipantReadState(
    executor: PrismaTransactionalClient,
    input: {
      conversationId: string;
      userId: string;
    },
  ): Promise<ConversationRead> {
    return executor.conversationRead.upsert({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: input.userId,
        },
      },
      create: {
        conversationId: input.conversationId,
        userId: input.userId,
      },
      update: {},
    });
  }

  async updateReadState(
    executor: PrismaTransactionalClient,
    input: {
      conversationId: string;
      userId: string;
      lastReadMessageId: string | null;
      lastReadSequence: number;
      lastReadAt: Date;
    },
  ): Promise<ConversationRead> {
    return executor.conversationRead.update({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: input.userId,
        },
      },
      data: {
        lastReadMessageId: input.lastReadMessageId,
        lastReadSequence: input.lastReadSequence,
        lastReadAt: input.lastReadAt,
      },
    });
  }
}

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByConversation(
    conversationId: string,
    input: {
      cursor?: string;
      limit: number;
    },
  ): Promise<{
    items: Message[];
    nextCursor: string | null;
  }> {
    const cursor = input.cursor ? decodeMessageCursor(input.cursor) : null;
    const items = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor
          ? {
              sequence: {
                lt: cursor.sequence,
              },
            }
          : {}),
      },
      orderBy: {
        sequence: "desc",
      },
      take: input.limit + 1,
    });

    const hasMore = items.length > input.limit;
    const pageItems = hasMore ? items.slice(0, input.limit) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems,
      nextCursor:
        hasMore && lastItem
          ? encodeMessageCursor({
              sequence: lastItem.sequence,
            })
          : null,
    };
  }

  async findByConversationAndSequence(
    conversationId: string,
    sequence: number,
    executor?: ConversationExecutor,
  ): Promise<Pick<Message, "id" | "sequence"> | null> {
    const db = executor ?? this.prisma;

    return db.message.findUnique({
      where: {
        conversationId_sequence: {
          conversationId,
          sequence,
        },
      },
      select: {
        id: true,
        sequence: true,
      },
    });
  }
}

export function conversationInclude(userId?: string) {
  return {
    circle: true,
    reads: { where: userId ? {} : { userId: { in: [] } } },
    members: { include: { user: userInclude() } },
    duoMatch: { include: { partyLow: true, partyHigh: true } },
    match: {
      include: {
        userLow: userInclude(),
        userHigh: userInclude(),
      },
    },
  } satisfies Prisma.ConversationInclude;
}

export function userInclude() {
  return {
    include: {
      profile: true,
      photos: {
        where: {
          moderationStatus: "APPROVED" as const,
          deletedAt: null,
          purpose: "PROFILE" as const,
        },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
        select: {
          id: true,
          objectKey: true,
          bucket: true,
          width: true,
          height: true,
          isPrimary: true,
          position: true,
        },
      },
      lifestyle: true,
      interests: {
        where: {
          deletedAt: null,
        },
        select: {
          interestTagId: true,
          interestTag: {
            select: {
              id: true,
              slug: true,
              displayName: true,
              category: true,
            },
          },
        },
      },
      intents: {
        where: {
          deletedAt: null,
        },
        select: {
          intent: true,
        },
      },
    },
  };
}

function encodeConversationCursor(value: {
  updatedAt: string;
  id: string;
}): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeConversationCursor(cursor: string): {
  updatedAt: string;
  id: string;
} {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as {
      updatedAt?: string;
      id?: string;
    };

    if (typeof parsed.updatedAt !== "string" || typeof parsed.id !== "string") {
      throw new Error("Invalid conversation cursor");
    }

    return {
      updatedAt: parsed.updatedAt,
      id: parsed.id,
    };
  } catch {
    throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
  }
}

function encodeMessageCursor(value: { sequence: number }): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeMessageCursor(cursor: string): { sequence: number } {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as {
      sequence?: number;
    };

    if (typeof parsed.sequence !== "number") {
      throw new Error("Invalid message cursor");
    }

    return {
      sequence: parsed.sequence,
    };
  } catch {
    throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
  }
}

/** Called in the four-vote transaction. Never joins a replacement member to history. */
export async function ensureDuoConversation(tx: PrismaTransactionalClient, duoMatchId: string, userIds: readonly string[]) {
  if (new Set(userIds).size !== 4) throw new Error("A Duo conversation requires four distinct members");
  const existing = await tx.conversation.findUnique({ where: { duoMatchId }, include: { members: true } });
  if (existing) {
    if (existing.members.length !== 4 || existing.members.some((member) => !userIds.includes(member.userId))) {
      throw new Error("Duo conversation membership is immutable");
    }
    return existing;
  }
  const conversation = await tx.conversation.create({ data: { duoMatchId } });
  await tx.conversationMember.createMany({ data: userIds.map((userId) => ({ conversationId: conversation.id, userId })) });
  await tx.conversationRead.createMany({ data: userIds.map((userId) => ({ conversationId: conversation.id, userId })), skipDuplicates: true });
  return conversation;
}
