import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import { Prisma } from "../../../generated/prisma/client";

export const DATE_PLAN_INCLUDE = {
  event: { select: { id: true, version: true, status: true, startsAt: true, verifiedAt: true } },
  responses: { orderBy: { createdAt: "asc" as const } },
  checkIns: true,
  reviewedVenue: { select: { photoUrl: true } },
  match: {
    select: {
      id: true,
      userLowId: true,
      userHighId: true,
      status: true,
      conversation: { select: { id: true } },
    },
  },
} satisfies Prisma.DatePlanInclude;

export type DatePlanRecord = Prisma.DatePlanGetPayload<{
  include: typeof DATE_PLAN_INCLUDE;
}>;

const MATCH_CONTEXT_INCLUDE = {
  userLow: {
    select: {
      id: true,
      status: true,
      isDiscoveryFrozen: true,
      profile: true,
      interests: {
        where: { deletedAt: null },
        include: { interestTag: true },
      },
      schedulePreference: true,
    },
  },
  userHigh: {
    select: {
      id: true,
      status: true,
      isDiscoveryFrozen: true,
      profile: true,
      interests: {
        where: { deletedAt: null },
        include: { interestTag: true },
      },
      schedulePreference: true,
    },
  },
} satisfies Prisma.MatchInclude;

export type DatePlanMatchContext = Prisma.MatchGetPayload<{
  include: typeof MATCH_CONTEXT_INCLUDE;
}>;

@Injectable()
export class DatePlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMatchContext(matchId: string): Promise<DatePlanMatchContext | null> {
    return this.prisma.match.findUnique({
      where: { id: matchId },
      include: MATCH_CONTEXT_INCLUDE,
    });
  }

  findById(
    id: string,
    executor: PrismaService | PrismaTransactionalClient = this.prisma,
  ): Promise<DatePlanRecord | null> {
    return executor.datePlan.findUnique({ where: { id }, include: DATE_PLAN_INCLUDE });
  }

  findIdempotent(input: {
    matchId: string;
    createdByUserId: string;
    idempotencyKey: string;
  }): Promise<DatePlanRecord | null> {
    return this.prisma.datePlan.findFirst({
      where: input,
      include: DATE_PLAN_INCLUDE,
    });
  }

  async listForMatch(input: {
    matchId: string;
    cursor?: string;
    limit: number;
  }): Promise<{ items: DatePlanRecord[]; nextCursor: string | null }> {
    return this.list({ matchId: input.matchId }, input.cursor, input.limit);
  }

  async listForUser(input: {
    userId: string;
    cursor?: string;
    limit: number;
  }): Promise<{ items: DatePlanRecord[]; nextCursor: string | null }> {
    return this.list(
      {
        match: {
          OR: [{ userLowId: input.userId }, { userHighId: input.userId }],
        },
      },
      input.cursor,
      input.limit,
    );
  }

  async create(
    tx: PrismaTransactionalClient,
    input: Prisma.DatePlanUncheckedCreateInput,
  ): Promise<DatePlanRecord> {
    return tx.datePlan.create({
      data: {
        ...input,
        responses: {
          create: {
            userId: input.createdByUserId,
            proposalVersion: input.proposalVersion ?? 1,
            response: "ACCEPTED",
          },
        },
      },
      include: DATE_PLAN_INCLUDE,
    });
  }

  private async list(
    where: Prisma.DatePlanWhereInput,
    cursor: string | undefined,
    limit: number,
  ): Promise<{ items: DatePlanRecord[]; nextCursor: string | null }> {
    const rows = await this.prisma.datePlan.findMany({
      where,
      include: DATE_PLAN_INCLUDE,
      orderBy: [{ proposedStartAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }
}
