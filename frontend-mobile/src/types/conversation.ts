import type {
  ContentModerationStatus,
  ConversationCloseReason,
  ConversationStatus,
  MessageStatus,
  MessageType,
} from "./enums";
import type { MessageAttachmentMimeType } from "./media";
import type { PublicProfileDto } from "./profile";

export interface ConversationSummaryDto {
  id: string;
  matchId: string | null;
  kind: "SOLO" | "DUO" | "CIRCLE";
  circleTitle?: string;
  duoMatchId: string | null;
  participants: PublicProfileDto[];
  readStates: Array<{ userId: string; lastReadSequence: number }>;
  status: ConversationStatus;
  otherUser: PublicProfileDto;
  lastMessageSequence: number;
  lastMessagePreview: string | null;
  lastMessageType: MessageType | null;
  lastMessageSentAt: string | null;
  lastSenderId: string | null;
  lastReadSequence: number;
  unreadCount: number;
  closedAt: string | null;
  closedReason: ConversationCloseReason | null;
  createdAt: string;
  updatedAt: string;
}

export type ConversationDetailDto = ConversationSummaryDto;

export interface ConversationPageDto {
  items: ConversationSummaryDto[];
  nextCursor: string | null;
}

export interface MessageAttachmentDto {
  objectKey: string | null;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  moderationStatus: ContentModerationStatus | null;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  sequence: number;
  clientMessageId: string | null;
  type: MessageType;
  textBody: string | null;
  attachment: MessageAttachmentDto;
  status: MessageStatus;
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

export interface CreateMessageRequest {
  clientMessageId: string;
  textBody: string;
  replyToMessageId?: string | null;
}

export interface InitiateMessageAttachmentUploadRequest {
  conversationId: string;
  fileName: string;
  mimeType: MessageAttachmentMimeType;
  sizeBytes: number;
  sha256?: string | null;
}

export interface InitiateMessageAttachmentUploadResponse {
  uploadToken: string;
  objectKey: string;
  bucket: string;
  method: "PUT";
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface FinalizeMessageAttachmentRequest {
  conversationId: string;
  clientMessageId: string;
  type: Exclude<MessageType, "TEXT" | "SYSTEM">;
  uploadToken: string;
  objectKey: string;
  bucket: string;
  mimeType: MessageAttachmentMimeType;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  replyToMessageId?: string | null;
}

export interface UpdateMessageRequest {
  textBody: string;
}

export interface ConversationReadRequest {
  lastReadSequence: number;
}

export interface ConversationReadResponse {
  conversationId: string;
  userId: string;
  lastReadMessageId: string | null;
  lastReadSequence: number;
  lastReadAt: string;
}

export interface ConversationMessagePageQuery {
  history?: "1";
  cursor?: string;
  limit?: number;
}
