import type { ReportReasonCode, ReportStatus, ReportTargetType } from "./enums";

export interface BlockedUserDto {
  id: string;
  blockerId: string;
  blockedId: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlockPageDto {
  items: BlockedUserDto[];
  nextCursor: string | null;
}

export interface CreateBlockRequest {
  blockedUserId: string;
  reason?: string | null;
}

export interface ReportDto {
  id: string;
  reporterUserId: string;
  reportedUserId: string | null;
  targetEventId?: string | null;
  targetType: ReportTargetType;
  reasonCode: ReportReasonCode;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
  closedAt: string | null;
}

export interface ReportPageDto {
  items: ReportDto[];
  nextCursor: string | null;
}

export interface CreateReportRequest {
  targetType: ReportTargetType;
  reportedUserId?: string | null;
  reasonCode: ReportReasonCode;
  description?: string | null;
  targetMatchId?: string | null;
  targetConversationId?: string | null;
  targetMessageId?: string | null;
  targetPhotoId?: string | null;
  targetCallSessionId?: string | null;
  targetEventId?: string;
  targetPrivateStoryId?: string | null;
}

export interface CreateReportResponse {
  report: ReportDto;
  isDuplicate: boolean;
  moderationCaseCreated: boolean;
}
