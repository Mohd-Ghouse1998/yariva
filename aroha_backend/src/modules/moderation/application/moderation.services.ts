import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type {
  ModerationAction,
  ModerationCase,
  ModerationCaseType,
  ModerationPriority,
  Prisma,
  TrustScore,
} from "../../../generated/prisma/client";
import { CreateNotificationService } from "../../notifications/application/notifications.services";
import { ProfileCompletionSyncService } from "../../profiles/application/profiles.services";
import { MODERATION_EVENTS } from "../events/moderation.events";
import type {
  ModerationCaseDto,
  ModerationCaseResponseDto,
  TrustScoreDto,
} from "../dto/moderation.dto";
import {
  ModerationCaseRepository,
  ModerationUserRepository,
  TrustScoreRepository,
} from "../infrastructure/moderation.infrastructure";

export interface ActionMetadata {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class CreateModerationCaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationCaseRepository: ModerationCaseRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: {
    subjectUserId: string;
    sourceReportId?: string | null;
    caseType: ModerationCaseType;
    priority?: ModerationPriority;
    summary?: string | null;
    findings?: Record<string, unknown>;
  }): Promise<ModerationCase> {
    const existing = input.sourceReportId
      ? await this.prisma.moderationCase.findFirst({
          where: { sourceReportId: input.sourceReportId },
        })
      : null;
    if (existing) {
      return existing;
    }

    const moderationCase = await this.prisma.$transaction((tx) =>
      this.moderationCaseRepository.create(tx, {
        subjectUserId: input.subjectUserId,
        sourceReportId: input.sourceReportId ?? null,
        caseType: input.caseType,
        priority: input.priority ?? "MEDIUM",
        summary: input.summary ?? null,
        findings: (input.findings ?? {}) as Prisma.InputJsonValue,
      }),
    );

    await this.domainEventPublisher.publishSafely(MODERATION_EVENTS.CASE_CREATED, {
      caseId: moderationCase.id,
      subjectUserId: moderationCase.subjectUserId,
    });

    return moderationCase;
  }
}

@Injectable()
export class RecomputeTrustScoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trustScoreRepository: TrustScoreRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(userId: string): Promise<TrustScoreDto> {
    const factors = await this.trustScoreRepository.loadFactors(userId);
    const score = Math.max(
      0,
      Math.min(
        100,
        70 -
          factors.reportsAgainst * 5 -
          factors.blocksReceived * 3 -
          factors.openCases * 8 -
          factors.actionedCases * 12,
      ),
    );
    const level = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
    const now = new Date();

    const trustScore = await this.prisma.$transaction((tx) =>
      this.trustScoreRepository.upsert(tx, {
        userId,
        score,
        level,
        factors: factors as unknown as Prisma.InputJsonValue,
        now,
      }),
    );

    await this.domainEventPublisher.publishSafely(
      MODERATION_EVENTS.TRUST_SCORE_RECOMPUTED,
      {
        userId,
        score: trustScore.score,
        level: trustScore.level,
      },
    );

    return mapTrustScore(trustScore);
  }
}

@Injectable()
export class AssignModerationCaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationCaseRepository: ModerationCaseRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    actor: AuthContext;
    caseId: string;
    assignedAdminUserId: string;
    metadata: ActionMetadata;
  }): Promise<ModerationCaseResponseDto> {
    const existing = await this.moderationCaseRepository.findById(input.caseId);
    if (!existing) {
      throw new AppException(
        404,
        ERROR_CODES.MODERATION_CASE_NOT_FOUND,
        "Moderation case not found",
      );
    }

    const moderationCase = await this.prisma.$transaction(async (tx) => {
      const updated = await this.moderationCaseRepository.assign(tx, {
        caseId: input.caseId,
        assignedAdminUserId: input.assignedAdminUserId,
      });
      await this.auditLogService.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "moderation.case.assign",
          entityType: "ModerationCase",
          entityId: input.caseId,
          targetUserId: updated.subjectUserId,
          ipAddress: input.metadata.ipAddress ?? null,
          userAgent: input.metadata.userAgent ?? null,
          metadata: { assignedAdminUserId: input.assignedAdminUserId },
        },
        tx,
      );
      return updated;
    });

    return { case: mapModerationCase(moderationCase) };
  }
}

@Injectable()
export class ApplyAccountActionService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      action: Exclude<ModerationAction, "NONE">;
      now: Date;
      sourceReportId?: string | null;
    },
  ): Promise<void> {
    switch (input.action) {
      case "NOTE_ONLY":
      case "WARN":
        return;
      case "HIDE_PROFILE":
        await tx.userProfile.updateMany({
          where: { userId: input.userId, deletedAt: null },
          data: { isHidden: true },
        });
        return;
      case "FREEZE_DISCOVERY":
        await tx.user.update({
          where: { id: input.userId },
          data: { isDiscoveryFrozen: true, status: "RESTRICTED" },
        });
        return;
      case "FREEZE_CHAT":
        await tx.user.update({
          where: { id: input.userId },
          data: { isChatFrozen: true, status: "RESTRICTED" },
        });
        return;
      case "FREEZE_CALLS":
        await tx.user.update({
          where: { id: input.userId },
          data: { isCallFrozen: true, status: "RESTRICTED" },
        });
        return;
      case "SHADOW_BAN":
        await tx.user.update({
          where: { id: input.userId },
          data: { isShadowBanned: true, status: "RESTRICTED" },
        });
        return;
      case "SUSPEND":
        await tx.user.update({
          where: { id: input.userId },
          data: { status: "SUSPENDED", suspendedAt: input.now },
        });
        return;
      case "BAN":
        await tx.user.update({
          where: { id: input.userId },
          data: { status: "BANNED", bannedAt: input.now },
        });
        return;
      case "REMOVE_PHOTO":
        await this.removeReportedPhoto(tx, input);
        return;
      case "RESTORE":
        await tx.user.update({
          where: { id: input.userId },
          data: {
            status: "ACTIVE",
            isShadowBanned: false,
            isDiscoveryFrozen: false,
            isChatFrozen: false,
            isCallFrozen: false,
            suspendedAt: null,
            bannedAt: null,
          },
        });
        await tx.userProfile.updateMany({
          where: { userId: input.userId, deletedAt: null },
          data: { isHidden: false },
        });
        return;
      default:
        throw new AppException(
          400,
          ERROR_CODES.MODERATION_ACTION_INVALID,
          "Unsupported moderation action",
        );
    }
  }

  private async removeReportedPhoto(
    tx: Prisma.TransactionClient,
    input: { userId: string; sourceReportId?: string | null; now: Date },
  ): Promise<void> {
    if (!input.sourceReportId) {
      return;
    }

    const report = await tx.report.findUnique({
      where: { id: input.sourceReportId },
      select: { targetPhotoId: true },
    });
    if (!report?.targetPhotoId) {
      return;
    }

    await tx.profilePhoto.updateMany({
      where: { id: report.targetPhotoId, userId: input.userId },
      data: {
        moderationStatus: "REJECTED",
        moderationReason: "Removed by moderation",
        reviewedAt: input.now,
        rejectedAt: input.now,
        deletedAt: input.now,
        isPrimary: false,
      },
    });
  }
}

@Injectable()
export class ApplyModerationActionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationCaseRepository: ModerationCaseRepository,
    private readonly accountActionService: ApplyAccountActionService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationService: CreateNotificationService,
    private readonly trustScoreService: RecomputeTrustScoreService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: {
    actor: AuthContext;
    caseId: string;
    action: Exclude<ModerationAction, "NONE">;
    actionNotes?: string | null;
    metadata: ActionMetadata;
  }): Promise<ModerationCaseResponseDto> {
    const existing = await this.moderationCaseRepository.findById(input.caseId);
    if (!existing) {
      throw new AppException(
        404,
        ERROR_CODES.MODERATION_CASE_NOT_FOUND,
        "Moderation case not found",
      );
    }

    if (!existing.subjectUserId && input.action !== "NOTE_ONLY") {
      throw new AppException(409, ERROR_CODES.CONFLICT, "Curate the reported event instead of applying an account action");
    }
    const now = new Date();
    const moderationCase = await this.prisma.$transaction(async (tx) => {
      if (existing.subjectUserId) await this.accountActionService.apply(tx, {
        userId: existing.subjectUserId,
        action: input.action,
        now,
        sourceReportId: existing.sourceReportId,
      });

      if (existing.sourceReportId) {
        await tx.report.update({
          where: { id: existing.sourceReportId },
          data: { status: "ACTIONED", closedAt: now },
        });
      }

      const updated = await this.moderationCaseRepository.applyAction(tx, {
        caseId: existing.id,
        action: input.action,
        actionNotes: input.actionNotes ?? null,
        findings: {
          ...(existing.findings && typeof existing.findings === "object" && !Array.isArray(existing.findings) ? existing.findings : {}),
          actionAppliedAt: now.toISOString(),
          appliedByUserId: input.actor.user.id,
        },
        now,
      });

      await this.auditLogService.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "moderation.action.apply",
          entityType: "ModerationCase",
          entityId: existing.id,
          targetUserId: existing.subjectUserId,
          ipAddress: input.metadata.ipAddress ?? null,
          userAgent: input.metadata.userAgent ?? null,
          metadata: {
            action: input.action,
            actionNotes: input.actionNotes ?? null,
          },
        },
        tx,
      );

      return updated;
    });

    if (moderationCase.subjectUserId) {
      await this.trustScoreService.execute(moderationCase.subjectUserId);
      await this.notificationService.execute({
        userId: moderationCase.subjectUserId,
        actorUserId: input.actor.user.id,
        type: "MODERATION_ACTION",
        title: "Account notice",
        body: "A moderation action was applied to your account.",
        data: { caseId: moderationCase.id, action: input.action },
        dedupeKey: ["MODERATION_ACTION", moderationCase.id, input.action].join(":"),
      });
    }
    await this.domainEventPublisher.publishSafely(
      MODERATION_EVENTS.ACTION_APPLIED,
      {
        caseId: moderationCase.id,
        subjectUserId: moderationCase.subjectUserId,
        action: input.action,
      },
    );

    return { case: mapModerationCase(moderationCase) };
  }
}

@Injectable()
export class PhotoModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly createModerationCaseService: CreateModerationCaseService,
    private readonly profileCompletionSyncService: ProfileCompletionSyncService,
    private readonly trustScoreService: RecomputeTrustScoreService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async reviewPendingPhoto(input: {
    photoId: string;
    approved?: boolean;
    reason?: string | null;
  }): Promise<void> {
    const photo = await this.prisma.profilePhoto.findUnique({
      where: { id: input.photoId },
    });
    if (!photo || photo.deletedAt || photo.moderationStatus !== "PENDING") {
      return;
    }

    const approved = input.approved ?? true;
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.profilePhoto.update({
        where: { id: photo.id },
        data: {
          moderationStatus: approved ? "APPROVED" : "REJECTED",
          moderationReason: approved ? null : (input.reason ?? "Rejected"),
          reviewedAt: now,
          approvedAt: approved ? now : null,
          rejectedAt: approved ? null : now,
        },
      });

      if (approved && photo.purpose === "PROFILE") {
        const primaryCount = await tx.profilePhoto.count({
          where: {
            userId: photo.userId,
            purpose: "PROFILE",
            deletedAt: null,
            isPrimary: true,
            moderationStatus: "APPROVED",
          },
        });
        if (primaryCount === 0) {
          await tx.profilePhoto.update({
            where: { id: photo.id },
            data: { isPrimary: true },
          });
        }
      }

      if (photo.purpose === "PROFILE") {
        await this.profileCompletionSyncService.recomputeAndPersist(
          photo.userId,
          tx,
          now,
        );
      }
    });

    if (!approved) {
      await this.createModerationCaseService.execute({
        subjectUserId: photo.userId,
        caseType: "PHOTO_REVIEW",
        priority: "LOW",
        summary: photo.purpose === "SCENE" ? "Scene photo rejected by moderation" : "Profile photo rejected by moderation",
        findings: { photoId: photo.id, purpose: photo.purpose, reason: input.reason ?? null },
      });
    }

    await this.trustScoreService.execute(photo.userId);
    await this.domainEventPublisher.publishSafely(MODERATION_EVENTS.PHOTO_REVIEWED, {
      photoId: photo.id,
      userId: photo.userId,
      moderationStatus: approved ? "APPROVED" : "REJECTED",
    });
  }
}

@Injectable()
export class ModerationUserReadService {
  constructor(private readonly userRepository: ModerationUserRepository) {}

  async assertExists(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.deletedAt) {
      throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "User not found");
    }
  }
}

export function mapModerationCase(
  moderationCase: ModerationCase,
): ModerationCaseDto {
  return {
    id: moderationCase.id,
    subjectUserId: moderationCase.subjectUserId,
    sourceReportId: moderationCase.sourceReportId,
    caseType: moderationCase.caseType,
    priority: moderationCase.priority,
    status: moderationCase.status,
    assignedAdminUserId: moderationCase.assignedAdminUserId,
    summary: moderationCase.summary,
    findings: normalizeJsonObject(moderationCase.findings),
    actionTaken: moderationCase.actionTaken,
    actionNotes: moderationCase.actionNotes,
    createdAt: moderationCase.createdAt.toISOString(),
    updatedAt: moderationCase.updatedAt.toISOString(),
    closedAt: moderationCase.closedAt?.toISOString() ?? null,
  };
}

export function mapTrustScore(trustScore: TrustScore): TrustScoreDto {
  return {
    score: trustScore.score,
    level: trustScore.level,
    factors: normalizeJsonObject(trustScore.factors),
    lastComputedAt: trustScore.lastComputedAt.toISOString(),
  };
}

function normalizeJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
