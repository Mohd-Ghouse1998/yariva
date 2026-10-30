import {
  IsDateString,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { Transform } from "class-transformer";
import {
  ApplyModerationActionDto,
  MODERATION_CASE_STATUS_VALUES,
  MODERATION_PRIORITY_VALUES,
} from "../../moderation/dto/moderation.dto";

export class AdminModerationCaseQueryDto {
  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  readonly limit?: number;

  @IsOptional()
  @IsIn(MODERATION_CASE_STATUS_VALUES)
  readonly status?: "OPEN" | "IN_REVIEW" | "ACTIONED" | "CLOSED";

  @IsOptional()
  @IsIn(MODERATION_PRIORITY_VALUES)
  readonly priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export class AdminAssignModerationCaseDto {
  @IsUUID("4")
  readonly assignedAdminUserId!: string;
}

export class AdminApplyModerationActionDto extends ApplyModerationActionDto {}

export class AdminReviewContentDto {
  @IsIn(["APPROVED", "REJECTED"])
  readonly decision!: "APPROVED" | "REJECTED";

  @IsOptional()
  @ValidateIf(({ reason }) => reason !== null)
  @IsString()
  @MaxLength(500)
  readonly reason?: string | null;
}

export class AdminReviewPrivateStoryDto extends AdminReviewContentDto {
  @IsDateString({ strict: true })
  readonly expectedUpdatedAt!: string;
}

export const ADMIN_USER_ACTION_VALUES = [
  "WARN",
  "HIDE_PROFILE",
  "FREEZE_DISCOVERY",
  "FREEZE_CHAT",
  "FREEZE_CALLS",
  "SHADOW_BAN",
  "SUSPEND",
  "BAN",
  "RESTORE",
] as const;

export class AdminUserActionDto {
  @IsIn(ADMIN_USER_ACTION_VALUES)
  readonly action!: (typeof ADMIN_USER_ACTION_VALUES)[number];

  @IsOptional()
  @ValidateIf(({ actionNotes }) => actionNotes !== null)
  @IsString()
  @MaxLength(2000)
  readonly actionNotes?: string | null;
}

export class AdminAuditLogQueryDto {
  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number;

  @IsOptional()
  @IsUUID("4")
  readonly actorUserId?: string;

  @IsOptional()
  @IsUUID("4")
  readonly targetUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly entityType?: string;
}

export class AdminAnalyticsSummaryQueryDto {
  @IsIn(["24h", "7d", "30d"])
  readonly window!: "24h" | "7d" | "30d";
}

export class EventPilotSummaryQueryDto {
  @IsString() @MaxLength(120) city!: string;
  @IsOptional() @IsIn(["24h", "7d", "30d"]) window?: "24h" | "7d" | "30d";
}
