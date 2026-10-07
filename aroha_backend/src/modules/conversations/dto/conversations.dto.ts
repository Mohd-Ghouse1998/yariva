import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { PublicProfileDto } from "../../discovery/dto/discovery.dto";

export interface ConversationSummaryDto {
  id: string;
  matchId: string | null;
  kind: "SOLO" | "DUO";
  duoMatchId: string | null;
  participants: PublicProfileDto[];
  readStates: Array<{ userId: string; lastReadSequence: number }>;
  status: "ACTIVE" | "BLOCKED" | "CLOSED_UNMATCHED" | "CLOSED_MODERATION";
  otherUser: PublicProfileDto;
  lastMessageSequence: number;
  lastMessagePreview: string | null;
  lastMessageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SYSTEM" | null;
  lastMessageSentAt: string | null;
  lastSenderId: string | null;
  lastReadSequence: number;
  unreadCount: number;
  closedAt: string | null;
  closedReason: "BLOCKED" | "UNMATCHED" | "MODERATION" | "ACCOUNT_DELETED" | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationPageDto {
  items: ConversationSummaryDto[];
  nextCursor: string | null;
}

export interface ConversationDetailResponseDto {
  conversation: ConversationSummaryDto;
}

export interface MessageAttachmentDto {
  objectKey: string | null;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  sequence: number;
  clientMessageId: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SYSTEM";
  textBody: string | null;
  attachment: MessageAttachmentDto;
  status:
    | "ACTIVE"
    | "PENDING_MODERATION"
    | "REMOVED_BY_MODERATION"
    | "DELETED_BY_SENDER";
  replyToMessageId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessagePageDto {
  items: MessageDto[];
  nextCursor: string | null;
}

export class ConversationReadRequestDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  readonly lastReadSequence!: number;
}

export interface ConversationReadDto {
  conversationId: string;
  userId: string;
  lastReadMessageId: string | null;
  lastReadSequence: number;
  lastReadAt: string;
}

export interface ConversationReadResponseDto {
  readState: ConversationReadDto;
}

export class ConversationMessagePageQueryDto {
  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number;
}
