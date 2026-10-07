import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";

export const REPORT_TARGET_TYPE_VALUES = [
  "USER",
  "MESSAGE",
  "PROFILE_PHOTO",
  "CONVERSATION",
  "MATCH",
  "CALL_SESSION",
  "PRIVATE_STORY",
] as const;

export const REPORT_REASON_CODE_VALUES = [
  "SPAM",
  "HARASSMENT",
  "INAPPROPRIATE_CONTENT",
  "FAKE_PROFILE",
  "UNDERAGE",
  "SAFETY_RISK",
  "OTHER",
] as const;

export type ReportTargetTypeValue =
  (typeof REPORT_TARGET_TYPE_VALUES)[number];
export type ReportReasonCodeValue =
  (typeof REPORT_REASON_CODE_VALUES)[number];

export class CreateReportDto {
  @IsUUID("4")
  readonly reportedUserId!: string;

  @IsIn(REPORT_TARGET_TYPE_VALUES)
  readonly targetType!: ReportTargetTypeValue;

  @IsIn(REPORT_REASON_CODE_VALUES)
  readonly reasonCode!: ReportReasonCodeValue;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly description?: string | null;

  @IsOptional()
  @ValidateIf(({ targetMatchId }) => targetMatchId !== null)
  @IsUUID("4")
  readonly targetMatchId?: string | null;

  @IsOptional()
  @ValidateIf(({ targetConversationId }) => targetConversationId !== null)
  @IsUUID("4")
  readonly targetConversationId?: string | null;

  @IsOptional()
  @ValidateIf(({ targetMessageId }) => targetMessageId !== null)
  @IsUUID("4")
  readonly targetMessageId?: string | null;

  @IsOptional()
  @ValidateIf(({ targetPhotoId }) => targetPhotoId !== null)
  @IsUUID("4")
  readonly targetPhotoId?: string | null;

  @IsOptional()
  @ValidateIf(({ targetCallSessionId }) => targetCallSessionId !== null)
  @IsUUID("4")
  readonly targetCallSessionId?: string | null;

  @IsOptional()
  @IsUUID("4")
  readonly targetPrivateStoryId?: string | null;
}

export interface ReportDto {
  id: string;
  reporterUserId: string;
  reportedUserId: string;
  targetType: ReportTargetTypeValue;
  reasonCode: ReportReasonCodeValue;
  description: string | null;
  status: "OPEN" | "UNDER_REVIEW" | "ACTIONED" | "CLOSED" | "DUPLICATE";
  createdAt: string;
  closedAt: string | null;
}

export interface CreateReportResponseDto {
  report: ReportDto;
  isDuplicate: boolean;
  moderationCaseCreated: boolean;
}

export interface ReportPageDto {
  items: ReportDto[];
  nextCursor: string | null;
}
