import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { Report, ReportTargetType } from "../../../generated/prisma/client";
import { RecomputeTrustScoreService } from "../../moderation/application/moderation.services";
import { PrivateStoriesService } from "../../private-stories/application/private-stories.service";
import { REPORT_EVENTS } from "../events/report.events";
import type {
  CreateReportDto,
  CreateReportResponseDto,
  ReportDto,
  ReportPageDto,
} from "../dto/reports.dto";
import {
  ReportDeduplicationService,
  ReportPolicyService,
} from "../domain/reports.domain";
import {
  ReportRepository,
  ReportTargetRepository,
} from "../infrastructure/reports.infrastructure";

export interface ReportActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class ListMyReportsService {
  constructor(private readonly reportRepository: ReportRepository) {}

  async execute(input: {
    reporterUserId: string;
    cursor?: string;
    limit?: number;
  }): Promise<ReportPageDto> {
    const page = await this.reportRepository.listByReporter({
      reporterUserId: input.reporterUserId,
      cursor: input.cursor,
      limit: input.limit ?? 20,
    });

    return {
      items: page.items.map(mapReport),
      nextCursor: page.nextCursor,
    };
  }
}

@Injectable()
export class CreateReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportRepository: ReportRepository,
    private readonly targetRepository: ReportTargetRepository,
    private readonly reportPolicyService: ReportPolicyService,
    private readonly deduplicationService: ReportDeduplicationService,
    private readonly auditLogService: AuditLogService,
    private readonly trustScoreService: RecomputeTrustScoreService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly privateStories: PrivateStoriesService,
  ) {}

  async execute(input: {
    actor: AuthContext;
    payload: CreateReportDto;
    metadata: ReportActionMetadata;
  }): Promise<CreateReportResponseDto> {
    this.reportPolicyService.assertCanReport({
      reporterUserId: input.actor.user.id,
      reportedUserId: input.payload.reportedUserId,
    });

    const targetId = await this.validateTarget(input.actor.user.id, input.payload);
    const dedupeKey = this.deduplicationService.buildDedupeKey({
      reporterUserId: input.actor.user.id,
      reportedUserId: input.payload.reportedUserId,
      targetType: input.payload.targetType,
      targetId,
      reasonCode: input.payload.reasonCode,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const reportResult = await this.reportRepository.createOrGet(tx, {
        reporterUserId: input.actor.user.id,
        reportedUserId: input.payload.reportedUserId,
        targetType: input.payload.targetType,
        reasonCode: input.payload.reasonCode,
        description: input.payload.description ?? null,
        targetMatchId: input.payload.targetMatchId ?? null,
        targetConversationId: input.payload.targetConversationId ?? null,
        targetMessageId: input.payload.targetMessageId ?? null,
        targetPhotoId: input.payload.targetPhotoId ?? null,
        targetCallSessionId: input.payload.targetCallSessionId ?? null,
        targetPrivateStoryId: input.payload.targetPrivateStoryId ?? null,
        status: "OPEN",
        dedupeKey,
      });

      let moderationCaseCreated = false;
      if (reportResult.created) {
        await tx.moderationCase.create({
          data: {
            subjectUserId: input.payload.reportedUserId,
            sourceReportId: reportResult.report.id,
            caseType:
              input.payload.targetType === "MESSAGE"
                ? "MESSAGE_REVIEW"
                : input.payload.targetType === "PROFILE_PHOTO"
                  ? "PHOTO_REVIEW"
                  : "USER_REPORT",
            priority:
              input.payload.reasonCode === "SAFETY_RISK" ||
              input.payload.reasonCode === "UNDERAGE"
                ? "HIGH"
                : "MEDIUM",
            summary: `Report: ${input.payload.reasonCode}`,
            findings: {
              targetType: input.payload.targetType,
              targetId,
            },
          },
        });
        moderationCaseCreated = true;
      }

      await this.auditLogService.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "report.create",
          entityType: "Report",
          entityId: reportResult.report.id,
          targetUserId: input.payload.reportedUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            targetType: input.payload.targetType,
            isDuplicate: !reportResult.created,
          },
        },
        tx,
      );

      return {
        report: reportResult.report,
        isDuplicate: !reportResult.created,
        moderationCaseCreated,
      };
    });

    await this.trustScoreService.execute(input.payload.reportedUserId);
    await this.domainEventPublisher.publishSafely(REPORT_EVENTS.CREATED, {
      reportId: result.report.id,
      reporterUserId: result.report.reporterUserId,
      reportedUserId: result.report.reportedUserId,
      isDuplicate: result.isDuplicate,
    });

    return {
      report: mapReport(result.report),
      isDuplicate: result.isDuplicate,
      moderationCaseCreated: result.moderationCaseCreated,
    };
  }

  private async validateTarget(
    reporterUserId: string,
    payload: CreateReportDto,
  ): Promise<string> {
    const reportedUser = await this.targetRepository.findUser(
      payload.reportedUserId,
    );
    if (!reportedUser || reportedUser.deletedAt) {
      throw new AppException(
        400,
        ERROR_CODES.REPORT_INVALID_TARGET,
        "Reported user is invalid",
      );
    }

    switch (payload.targetType) {
      case "USER":
        return payload.reportedUserId;
      case "MESSAGE":
        return this.validateMessageTarget(reporterUserId, payload);
      case "PROFILE_PHOTO":
        return this.validatePhotoTarget(payload);
      case "CONVERSATION":
        return this.validateConversationTarget(reporterUserId, payload);
      case "MATCH":
        return this.validateMatchTarget(reporterUserId, payload);
      case "CALL_SESSION":
        return this.validateCallTarget(reporterUserId, payload);
      case "PRIVATE_STORY":
        return this.validatePrivateStoryTarget(reporterUserId, payload);
      default:
        throw new AppException(
          400,
          ERROR_CODES.REPORT_INVALID_TARGET,
          "Report target is invalid",
        );
    }
  }

  private async validateMessageTarget(
    reporterUserId: string,
    payload: CreateReportDto,
  ): Promise<string> {
    if (!payload.targetMessageId) {
      throw invalidTarget();
    }
    const message = await this.targetRepository.findMessage(payload.targetMessageId);
    if (
      !message ||
      message.senderId !== payload.reportedUserId ||
      !conversationIncludes(message.conversation, reporterUserId, payload.reportedUserId)
    ) {
      throw invalidTarget();
    }
    return message.id;
  }

  private async validatePhotoTarget(payload: CreateReportDto): Promise<string> {
    if (!payload.targetPhotoId) {
      throw invalidTarget();
    }
    const photo = await this.targetRepository.findPhoto(payload.targetPhotoId);
    if (!photo || photo.userId !== payload.reportedUserId) {
      throw invalidTarget();
    }
    return photo.id;
  }

  private async validateConversationTarget(
    reporterUserId: string,
    payload: CreateReportDto,
  ): Promise<string> {
    if (!payload.targetConversationId) {
      throw invalidTarget();
    }
    const conversation = await this.targetRepository.findConversation(
      payload.targetConversationId,
    );
    if (
      !conversation ||
      !conversationIncludes(conversation, reporterUserId, payload.reportedUserId)
    ) {
      throw invalidTarget();
    }
    return conversation.id;
  }

  private async validateMatchTarget(
    reporterUserId: string,
    payload: CreateReportDto,
  ): Promise<string> {
    if (!payload.targetMatchId) {
      throw invalidTarget();
    }
    const match = await this.targetRepository.findMatch(payload.targetMatchId);
    if (
      !match ||
      !participantsInclude(
        match.userLowId,
        match.userHighId,
        reporterUserId,
        payload.reportedUserId,
      )
    ) {
      throw invalidTarget();
    }
    return match.id;
  }

  private async validateCallTarget(
    reporterUserId: string,
    payload: CreateReportDto,
  ): Promise<string> {
    if (!payload.targetCallSessionId) {
      throw invalidTarget();
    }
    const call = await this.targetRepository.findCall(payload.targetCallSessionId);
    if (
      !call ||
      !participantsInclude(
        call.initiatorUserId,
        call.receiverUserId,
        reporterUserId,
        payload.reportedUserId,
      )
    ) {
      throw invalidTarget();
    }
    return call.id;
  }

  private async validatePrivateStoryTarget(reporterUserId: string, payload: CreateReportDto): Promise<string> {
    if (!payload.targetPrivateStoryId) throw invalidTarget();
    // Reuse the Story's full, fail-closed read policy instead of relying on a
    // stale client audience or the mere existence of a grant.
    try { await this.privateStories.assertReportable(reporterUserId, payload.targetPrivateStoryId, payload.reportedUserId); }
    catch { throw invalidTarget(); }
    return payload.targetPrivateStoryId;
  }
}

export function mapReport(report: Report): ReportDto {
  return {
    id: report.id,
    reporterUserId: report.reporterUserId,
    reportedUserId: report.reportedUserId,
    targetType: report.targetType,
    reasonCode: report.reasonCode,
    description: report.description,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
    closedAt: report.closedAt?.toISOString() ?? null,
  };
}

function participantsInclude(
  userA: string,
  userB: string,
  reporterUserId: string,
  reportedUserId: string,
): boolean {
  return (
    ((userA === reporterUserId && userB === reportedUserId) ||
      (userA === reportedUserId && userB === reporterUserId))
  );
}

function invalidTarget(): AppException {
  return new AppException(
    400,
    ERROR_CODES.REPORT_INVALID_TARGET,
    "Report target is invalid",
  );
}


function conversationIncludes(context: { match: { userLowId: string; userHighId: string } | null; members: { userId: string }[] }, reporterId: string, reportedId: string): boolean {
  const ids = context.match ? [context.match.userLowId, context.match.userHighId] : context.members.map((member) => member.userId);
  return reporterId !== reportedId && ids.includes(reporterId) && ids.includes(reportedId);
}
