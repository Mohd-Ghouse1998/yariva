import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export const MODERATION_CASE_STATUS_VALUES = [
  "OPEN",
  "IN_REVIEW",
  "ACTIONED",
  "CLOSED",
] as const;

export const MODERATION_PRIORITY_VALUES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export const MODERATION_ACTION_VALUES = [
  "NONE",
  "NOTE_ONLY",
  "WARN",
  "REMOVE_PHOTO",
  "HIDE_PROFILE",
  "FREEZE_DISCOVERY",
  "FREEZE_CHAT",
  "FREEZE_CALLS",
  "SHADOW_BAN",
  "SUSPEND",
  "BAN",
  "RESTORE",
] as const;

export type ModerationActionValue = (typeof MODERATION_ACTION_VALUES)[number];

export class AssignModerationCaseDto {
  @IsUUID("4")
  readonly assignedAdminUserId!: string;
}

export class ApplyModerationActionDto {
  @IsIn(MODERATION_ACTION_VALUES.filter((action) => action !== "NONE"))
  readonly action!: Exclude<ModerationActionValue, "NONE">;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly actionNotes?: string | null;
}

export interface ModerationCaseDto {
  id: string;
  subjectUserId: string | null;
  sourceReportId: string | null;
  caseType:
    | "USER_REPORT"
    | "PHOTO_REVIEW"
    | "TRUST_REVIEW"
    | "PROFILE_REVIEW"
    | "MESSAGE_REVIEW";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_REVIEW" | "ACTIONED" | "CLOSED";
  assignedAdminUserId: string | null;
  summary: string | null;
  findings: Record<string, unknown>;
  actionTaken: ModerationActionValue;
  actionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface ModerationCaseResponseDto {
  case: ModerationCaseDto;
}

export interface TrustScoreDto {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH";
  factors: Record<string, unknown>;
  lastComputedAt: string;
}

