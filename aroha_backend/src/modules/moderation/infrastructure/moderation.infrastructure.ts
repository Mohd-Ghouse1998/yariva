import { Injectable } from "@nestjs/common";
import { decodeDateIdCursor, encodeDateIdCursor } from "../../../common/utils/cursor.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  ModerationAction,
  ModerationCase,
  ModerationCaseStatus,
  ModerationPriority,
  Prisma,
  TrustScore,
  User,
} from "../../../generated/prisma/client";

export interface ModerationCaseListQuery {
  cursor?: string;
  limit: number;
  status?: ModerationCaseStatus;
  priority?: ModerationPriority;
}

@Injectable()
export class ModerationCaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ModerationCaseListQuery): Promise<{
    items: ModerationCase[];
    nextCursor: string | null;
  }> {
    const cursor = input.cursor ? decodeDateIdCursor(input.cursor) : null;
    const items = await this.prisma.moderationCase.findMany({
      where: {
        status: input.status,
        priority: input.priority,
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

  async findById(caseId: string): Promise<ModerationCase | null> {
    return this.prisma.moderationCase.findUnique({
      where: { id: caseId },
    });
  }

  async create(
    executor: PrismaTransactionalClient,
    input: Prisma.ModerationCaseUncheckedCreateInput,
  ): Promise<ModerationCase> {
    return executor.moderationCase.create({ data: input });
  }

  async assign(
    executor: PrismaTransactionalClient,
    input: { caseId: string; assignedAdminUserId: string },
  ): Promise<ModerationCase> {
    return executor.moderationCase.update({
      where: { id: input.caseId },
      data: {
        assignedAdminUserId: input.assignedAdminUserId,
        status: "IN_REVIEW",
      },
    });
  }

  async applyAction(
    executor: PrismaTransactionalClient,
    input: {
      caseId: string;
      action: Exclude<ModerationAction, "NONE">;
      actionNotes: string | null;
      findings?: Prisma.InputJsonValue;
      now: Date;
    },
  ): Promise<ModerationCase> {
    return executor.moderationCase.update({
      where: { id: input.caseId },
      data: {
        status: "ACTIONED",
        actionTaken: input.action,
        actionNotes: input.actionNotes,
        findings: input.findings,
        closedAt: input.now,
      },
    });
  }
}

@Injectable()
export class TrustScoreRepository {
  constructor(private readonly prisma: PrismaService) {}

  async loadFactors(userId: string): Promise<{
    reportsAgainst: number;
    openCases: number;
    actionedCases: number;
    blocksReceived: number;
  }> {
    const [reportsAgainst, openCases, actionedCases, blocksReceived] =
      await Promise.all([
        this.prisma.report.count({ where: { reportedUserId: userId } }),
        this.prisma.moderationCase.count({
          where: { subjectUserId: userId, status: { in: ["OPEN", "IN_REVIEW"] } },
        }),
        this.prisma.moderationCase.count({
          where: { subjectUserId: userId, status: "ACTIONED" },
        }),
        this.prisma.block.count({
          where: { blockedId: userId, deletedAt: null },
        }),
      ]);

    return { reportsAgainst, openCases, actionedCases, blocksReceived };
  }

  async upsert(
    executor: PrismaTransactionalClient,
    input: {
      userId: string;
      score: number;
      level: "LOW" | "MEDIUM" | "HIGH";
      factors: Prisma.InputJsonValue;
      now: Date;
    },
  ): Promise<TrustScore> {
    return executor.trustScore.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        score: input.score,
        level: input.level,
        factors: input.factors,
        lastComputedAt: input.now,
      },
      update: {
        score: input.score,
        level: input.level,
        factors: input.factors,
        lastComputedAt: input.now,
      },
    });
  }
}

@Injectable()
export class ModerationUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }
}

