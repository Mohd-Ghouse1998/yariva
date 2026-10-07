import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export const NOTIFICATION_TYPE_VALUES = [
  "NEW_LIKE",
  "NEW_MATCH",
  "NEW_MESSAGE",
  "MISSED_CALL",
  "DATE_PROPOSED",
  "DATE_ACCEPTED",
  "DATE_CHANGED",
  "DATE_CANCELLED",
  "DATE_REMINDER",
  "SAFETY_CHECK_IN",
  "MUTUAL_MEET_AGAIN",
  "REPORT_UPDATE",
  "MODERATION_ACTION",
  "SYSTEM",
] as const;

export const NOTIFICATION_CHANNEL_VALUES = ["IN_APP", "PUSH"] as const;

export type NotificationTypeValue = (typeof NOTIFICATION_TYPE_VALUES)[number];
export type NotificationChannelValue =
  (typeof NOTIFICATION_CHANNEL_VALUES)[number];

export interface NotificationDto {
  id: string;
  type: NotificationTypeValue;
  channel: NotificationChannelValue;
  title: string;
  body: string;
  data: Record<string, unknown>;
  actor: {
    userId: string;
    displayName: string | null;
  } | null;
  status: "PENDING" | "SENT" | "FAILED" | "READ" | "CANCELED";
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface NotificationPageDto {
  items: NotificationDto[];
  nextCursor: string | null;
}

export interface NotificationResponseDto {
  notification: NotificationDto;
}

export class CreateNotificationInputDto {
  @IsUUID("4")
  readonly userId!: string;

  @IsOptional()
  @IsUUID("4")
  readonly actorUserId?: string | null;

  @IsIn(NOTIFICATION_TYPE_VALUES)
  readonly type!: NotificationTypeValue;

  @IsOptional()
  @IsIn(NOTIFICATION_CHANNEL_VALUES)
  readonly channel?: NotificationChannelValue;

  @IsString()
  @MaxLength(140)
  readonly title!: string;

  @IsString()
  @MaxLength(500)
  readonly body!: string;

  @IsOptional()
  @IsObject()
  readonly data?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  readonly dedupeKey?: string | null;
}
