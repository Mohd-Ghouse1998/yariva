import { Injectable } from "@nestjs/common";
import { decodeDateIdCursor, encodeDateIdCursor } from "../../../common/utils/cursor.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  CallSession,
  Conversation,
  Match,
  Message,
  Prisma,
  ProfilePhoto,
  Report,
  User,
} from "../../../generated/prisma/client";

export interface ReportTargetContext {
  reportedUser: Pick<User, "id" | "deletedAt"> | null;
  targetId: string;
}

@Injectable()
export class ReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByReporter(input: {
    reporterUserId: string;
    cursor?: string;
    limit: number;
  }): Promise<{ items: Report[]; nextCursor: string | null }> {
    const cursor = input.cursor ? decodeDateIdCursor(input.cursor) : null;
    const items = await this.prisma.report.findMany({
      where: {
        reporterUserId: input.reporterUserId,
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

  async createOrGet(
    executor: PrismaTransactionalClient,
    input: Prisma.ReportUncheckedCreateInput,
  ): Promise<{ report: Report; created: boolean }> {
    const existing = await executor.report.findUnique({
      where: { dedupeKey: input.dedupeKey },
    });
    if (existing) {
      return { report: existing, created: false };
    }

    return {
      report: await executor.report.create({ data: input }),
      created: true,
    };
  }
}

@Injectable()
export class ReportTargetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(userId: string): Promise<Pick<User, "id" | "deletedAt"> | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
  }

  async findMessage(
    messageId: string,
  ): Promise<
    | (Pick<Message, "id" | "senderId" | "conversationId"> & {
        conversation: Pick<Conversation, "id" | "matchId"> & {
          match: Pick<Match, "userLowId" | "userHighId"> | null;
          members: { userId: string }[];
        };
      })
    | null
  > {
    return this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        senderId: true,
        conversationId: true,
        conversation: {
          select: {
            id: true,
            matchId: true,
            match: { select: { userLowId: true, userHighId: true } },
        members: { select: { userId: true } },
          },
        },
      },
    });
  }

  async findPhoto(
    photoId: string,
  ): Promise<Pick<ProfilePhoto, "id" | "userId"> | null> {
    return this.prisma.profilePhoto.findUnique({
      where: { id: photoId },
      select: { id: true, userId: true },
    });
  }

  async findConversation(
    conversationId: string,
  ): Promise<
    | (Pick<Conversation, "id" | "matchId"> & {
        match: Pick<Match, "userLowId" | "userHighId"> | null;
          members: { userId: string }[];
      })
    | null
  > {
    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        matchId: true,
        match: { select: { userLowId: true, userHighId: true } },
        members: { select: { userId: true } },
      },
    });
  }

  async findMatch(
    matchId: string,
  ): Promise<Pick<Match, "id" | "userLowId" | "userHighId"> | null> {
    return this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, userLowId: true, userHighId: true },
    });
  }

  async findCall(
    callSessionId: string,
  ): Promise<
    | Pick<
        CallSession,
        "id" | "initiatorUserId" | "receiverUserId" | "matchId" | "conversationId"
      >
    | null
  > {
    return this.prisma.callSession.findUnique({
      where: { id: callSessionId },
      select: {
        id: true,
        initiatorUserId: true,
        receiverUserId: true,
        matchId: true,
        conversationId: true,
      },
    });
  }
}
