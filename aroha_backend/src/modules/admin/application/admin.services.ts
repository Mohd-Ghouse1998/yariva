import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { decodeDateIdCursor, encodeDateIdCursor } from "../../../common/utils/cursor.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type {
  AuditLog,
  ModerationAction,
  Prisma,
  User,
} from "../../../generated/prisma/client";
import { AnalyticsSummaryService } from "../../analytics/application/analytics.services";
import type { AnalyticsSummaryDto } from "../../analytics/dto/analytics.dto";
import {
  ListFeatureFlagsService,
  UpsertFeatureFlagService,
} from "../../feature-flags/application/feature-flags.services";
import type {
  FeatureFlagListDto,
  FeatureFlagResponseDto,
  UpsertFeatureFlagDto,
} from "../../feature-flags/dto/feature-flags.dto";
import {
  ApplyAccountActionService,
  ApplyModerationActionService,
  AssignModerationCaseService,
  mapModerationCase,
  mapTrustScore,
  RecomputeTrustScoreService,
} from "../../moderation/application/moderation.services";
import type {
  ModerationCaseDto,
  ModerationCaseResponseDto,
  TrustScoreDto,
} from "../../moderation/dto/moderation.dto";
import { ModerationCaseRepository } from "../../moderation/infrastructure/moderation.infrastructure";
import { CreateNotificationService } from "../../notifications/application/notifications.services";
import type {
  AdminAuditLogQueryDto,
  AdminModerationCaseQueryDto,
  AdminUserActionDto,
} from "../dto/admin.dto";

@Injectable()
export class AdminModerationService {
  constructor(
    private readonly moderationCaseRepository: ModerationCaseRepository,
    private readonly assignModerationCaseService: AssignModerationCaseService,
    private readonly applyModerationActionService: ApplyModerationActionService,
  ) {}

  async listCases(query: AdminModerationCaseQueryDto): Promise<{
    items: ModerationCaseDto[];
    nextCursor: string | null;
  }> {
    const page = await this.moderationCaseRepository.list({
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 50) : 20,
      status: query.status,
      priority: query.priority,
    });

    return {
      items: page.items.map(mapModerationCase),
      nextCursor: page.nextCursor,
    };
  }

  async getCase(caseId: string): Promise<ModerationCaseResponseDto> {
    const moderationCase = await this.moderationCaseRepository.findById(caseId);
    if (!moderationCase) {
      throw new AppException(
        404,
        ERROR_CODES.MODERATION_CASE_NOT_FOUND,
        "Moderation case not found",
      );
    }

    return { case: mapModerationCase(moderationCase) };
  }

  async assignCase(input: {
    actor: AuthContext;
    caseId: string;
    assignedAdminUserId: string;
    metadata: { ipAddress: string | null; userAgent: string | null };
  }): Promise<ModerationCaseResponseDto> {
    return this.assignModerationCaseService.execute(input);
  }

  async applyAction(input: {
    actor: AuthContext;
    caseId: string;
    action: Exclude<ModerationAction, "NONE">;
    actionNotes?: string | null;
    metadata: { ipAddress: string | null; userAgent: string | null };
  }): Promise<ModerationCaseResponseDto> {
    return this.applyModerationActionService.execute(input);
  }
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountActionService: ApplyAccountActionService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationService: CreateNotificationService,
    private readonly trustScoreService: RecomputeTrustScoreService,
  ) {}

  async getUser(userId: string): Promise<{
    user: ReturnType<typeof mapAdminUser>;
    profile: Record<string, unknown> | null;
    trustScore: TrustScoreDto;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        photos: {
          where: { deletedAt: null },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        },
        trustScore: true,
      },
    });
    if (!user || user.deletedAt) {
      throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "User not found");
    }

    const trustScore =
      user.trustScore ?? (await this.prisma.trustScore.findUnique({ where: { userId } }));

    return {
      user: mapAdminUser(user),
      profile: user.profile
        ? {
            ...user.profile,
            dateOfBirth: user.profile.dateOfBirth?.toISOString() ?? null,
            createdAt: user.profile.createdAt.toISOString(),
            updatedAt: user.profile.updatedAt.toISOString(),
            photos: user.photos.map((photo) => ({
              ...photo,
              createdAt: photo.createdAt.toISOString(),
              updatedAt: photo.updatedAt.toISOString(),
            })),
          }
        : null,
      trustScore: trustScore
        ? mapTrustScore(trustScore)
        : await this.trustScoreService.execute(userId),
    };
  }

  async applyUserAction(input: {
    actor: AuthContext;
    userId: string;
    payload: AdminUserActionDto;
    metadata: { ipAddress: string | null; userAgent: string | null };
  }): Promise<{ user: ReturnType<typeof mapAdminUser> }> {
    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!user || user.deletedAt) {
      throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "User not found");
    }

    const now = new Date();
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await this.accountActionService.apply(tx, {
        userId: input.userId,
        action: input.payload.action,
        now,
      });

      await this.auditLogService.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "admin.user.action",
          entityType: "User",
          entityId: input.userId,
          targetUserId: input.userId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            action: input.payload.action,
            actionNotes: input.payload.actionNotes ?? null,
          },
        },
        tx,
      );

      return tx.user.findUniqueOrThrow({ where: { id: input.userId } });
    });

    await this.trustScoreService.execute(input.userId);
    await this.notificationService.execute({
      userId: input.userId,
      actorUserId: input.actor.user.id,
      type: "MODERATION_ACTION",
      title: "Account notice",
      body: "An account action was applied.",
      data: { action: input.payload.action },
      dedupeKey: ["ADMIN_USER_ACTION", input.userId, input.payload.action, now.toISOString()].join(":"),
    });

    return { user: mapAdminUser(updatedUser) };
  }
}

@Injectable()
export class AdminFeatureFlagsService {
  constructor(
    private readonly listFeatureFlagsService: ListFeatureFlagsService,
    private readonly upsertFeatureFlagService: UpsertFeatureFlagService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(): Promise<FeatureFlagListDto> {
    return this.listFeatureFlagsService.execute();
  }

  async upsert(input: {
    actor: AuthContext;
    key: string;
    payload: UpsertFeatureFlagDto;
    metadata: { ipAddress: string | null; userAgent: string | null };
  }): Promise<FeatureFlagResponseDto> {
    const result = await this.upsertFeatureFlagService.execute({
      key: input.key,
      payload: input.payload,
      actorUserId: input.actor.user.id,
    });

    await this.auditLogService.write({
      actorUserId: input.actor.user.id,
      actorSessionId: input.actor.session.id,
      action: "feature-flag.upsert",
      entityType: "FeatureFlag",
      entityId: result.featureFlag.id,
      targetUserId: null,
      ipAddress: input.metadata.ipAddress,
      userAgent: input.metadata.userAgent,
      metadata: { key: input.key, enabled: input.payload.enabled },
    });

    return result;
  }
}

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly analyticsSummaryService: AnalyticsSummaryService) {}

  async summary(window: "24h" | "7d" | "30d"): Promise<AnalyticsSummaryDto> {
    return this.analyticsSummaryService.execute(window);
  }
}

@Injectable()
export class AdminAuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminAuditLogQueryDto): Promise<{
    items: ReturnType<typeof mapAuditLog>[];
    nextCursor: string | null;
  }> {
    const limit = query.limit ? Math.min(query.limit, 100) : 50;
    const cursor = query.cursor ? decodeDateIdCursor(query.cursor) : null;
    const items = await this.prisma.auditLog.findMany({
      where: {
        actorUserId: query.actorUserId,
        targetUserId: query.targetUserId,
        entityType: query.entityType,
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
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems.map(mapAuditLog),
      nextCursor:
        hasMore && lastItem
          ? encodeDateIdCursor({
              createdAt: lastItem.createdAt.toISOString(),
              id: lastItem.id,
            })
          : null,
    };
  }
}

function mapAdminUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    isShadowBanned: user.isShadowBanned,
    isDiscoveryFrozen: user.isDiscoveryFrozen,
    isChatFrozen: user.isChatFrozen,
    isCallFrozen: user.isCallFrozen,
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function mapAuditLog(log: AuditLog) {
  return {
    id: log.id,
    actorUserId: log.actorUserId,
    actorSessionId: log.actorSessionId,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    targetUserId: log.targetUserId,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    metadata: normalizeJsonObject(log.metadata),
    createdAt: log.createdAt.toISOString(),
  };
}

function normalizeJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
