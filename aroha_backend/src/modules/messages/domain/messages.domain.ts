import { conversationParticipantIds, conversationUsers, relationshipIsActive, type ConversationContext } from "../../conversations/domain/conversation-context";
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type {
  Conversation,
  ContentModerationStatus,
  Match,
  Message,
  MessageType,
  User,
} from "../../../generated/prisma/client";
import type {
  FinalizeMessageAttachmentDto,
  InitiateMessageAttachmentUploadDto,
} from "../dto/messages.dto";

const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
const IMAGE_MAX_SIZE_BYTES = 15 * 1024 * 1024;
const VIDEO_MAX_SIZE_BYTES = 50 * 1024 * 1024;
const AUDIO_MAX_SIZE_BYTES = 15 * 1024 * 1024;

export type ConversationAccessRecord = Pick<
  Conversation,
  "id" | "status" | "lastMessageSequence"
> & ConversationContext;

type MessageOwnershipRecord = Pick<
  Message,
  | "id"
  | "senderId"
  | "conversationId"
  | "type"
  | "status"
  | "createdAt"
  | "sequence"
>;

@Injectable()
export class MessagePolicyService {
  assertConversationWritable(
    conversation: ConversationAccessRecord | null,
    actorUserId: string,
    isBlocked: boolean,
  ): asserts conversation is ConversationAccessRecord {
    if (!conversation) {
      throw new AppException(
        404,
        ERROR_CODES.CONVERSATION_NOT_FOUND,
        "Conversation not found",
      );
    }

    const participantIds = conversationParticipantIds(conversation);
    if (!participantIds.includes(actorUserId)) {
      throw new AppException(
        403,
        ERROR_CODES.CONVERSATION_NOT_ACCESSIBLE,
        "Conversation is not accessible",
      );
    }

    if (conversation.status !== "ACTIVE" || !relationshipIsActive(conversation)) {
      throw new AppException(
        409,
        ERROR_CODES.CONVERSATION_CLOSED,
        "Conversation no longer accepts activity",
      );
    }

    if (isBlocked) {
      throw new AppException(
        403,
        ERROR_CODES.FORBIDDEN,
        "Conversation is blocked",
      );
    }

    const users = conversationUsers(conversation);
    const actor = users.find((user) => user.id === actorUserId)!;
    const otherUsers = users.filter((user) => user.id !== actorUserId);

    if (actor.deletedAt || actor.status !== "ACTIVE" || actor.isChatFrozen) {
      throw new AppException(
        403,
        ERROR_CODES.FORBIDDEN,
        "Messaging is not allowed for this account",
      );
    }

    if (otherUsers.some((user) => user.deletedAt || user.status !== "ACTIVE" || user.isChatFrozen)) {
      throw new AppException(
        409,
        ERROR_CODES.CONVERSATION_CLOSED,
        "Conversation no longer accepts activity",
      );
    }
  }

  assertTextBody(textBody: string): void {
    if (textBody.trim().length === 0) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_TEXT_REQUIRED,
        "Message text is required",
      );
    }
  }

  assertReplyTargetBelongsToConversation(
    replyTarget:
      | Pick<Message, "id" | "conversationId">
      | null,
    conversationId: string,
  ): void {
    if (!replyTarget || replyTarget.conversationId !== conversationId) {
      throw new AppException(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        "Reply target is invalid",
      );
    }
  }

  assertEditable(
    message: MessageOwnershipRecord | null,
    actorUserId: string,
    now: Date,
  ): asserts message is MessageOwnershipRecord {
    if (!message) {
      throw new AppException(
        404,
        ERROR_CODES.MESSAGE_NOT_FOUND,
        "Message not found",
      );
    }

    if (message.senderId !== actorUserId) {
      throw new AppException(
        403,
        ERROR_CODES.MESSAGE_NOT_OWNED,
        "Message belongs to another sender",
      );
    }

    if (message.status === "DELETED_BY_SENDER" || message.status === "REMOVED_BY_MODERATION") {
      throw new AppException(
        409,
        ERROR_CODES.MESSAGE_ALREADY_DELETED,
        "Message was already deleted",
      );
    }

    if (message.type !== "TEXT") {
      throw new AppException(
        409,
        ERROR_CODES.MESSAGE_EDIT_WINDOW_EXPIRED,
        "Only text messages can be edited",
      );
    }

    if (now.getTime() - message.createdAt.getTime() > MESSAGE_EDIT_WINDOW_MS) {
      throw new AppException(
        409,
        ERROR_CODES.MESSAGE_EDIT_WINDOW_EXPIRED,
        "Message can no longer be edited",
      );
    }
  }

  assertDeletable(
    message: MessageOwnershipRecord | null,
    actorUserId: string,
  ): asserts message is MessageOwnershipRecord {
    if (!message) {
      throw new AppException(
        404,
        ERROR_CODES.MESSAGE_NOT_FOUND,
        "Message not found",
      );
    }

    if (message.senderId !== actorUserId) {
      throw new AppException(
        403,
        ERROR_CODES.MESSAGE_NOT_OWNED,
        "Message belongs to another sender",
      );
    }

    if (message.status === "DELETED_BY_SENDER" || message.status === "REMOVED_BY_MODERATION") {
      throw new AppException(
        409,
        ERROR_CODES.MESSAGE_ALREADY_DELETED,
        "Message was already deleted",
      );
    }
  }
}

@Injectable()
export class MessageSequenceService {
  nextValue(currentLastSequence: number): number {
    return currentLastSequence + 1;
  }
}

@Injectable()
export class AttachmentPolicyService {
  private readonly mimeTypeToType: Record<string, "IMAGE" | "VIDEO" | "AUDIO"> = {
    "image/jpeg": "IMAGE",
    "image/png": "IMAGE",
    "image/webp": "IMAGE",
    "video/mp4": "VIDEO",
    "video/quicktime": "VIDEO",
    "audio/mpeg": "AUDIO",
    "audio/mp4": "AUDIO",
    "audio/aac": "AUDIO",
    "audio/wav": "AUDIO",
  };

  assertUploadAllowed(input: InitiateMessageAttachmentUploadDto): void {
    const derivedType = this.mimeTypeToType[input.mimeType];
    if (!derivedType) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_ATTACHMENT_INVALID_TYPE,
        "Attachment type is invalid",
      );
    }

    this.assertMaxSize(derivedType, input.sizeBytes);
  }

  assertFinalizeAllowed(input: FinalizeMessageAttachmentDto): void {
    const derivedType = this.mimeTypeToType[input.mimeType];
    if (!derivedType || derivedType !== input.type) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_ATTACHMENT_INVALID_TYPE,
        "Attachment type is invalid",
      );
    }

    this.assertMaxSize(input.type, input.sizeBytes);

    if ((input.type === "IMAGE" || input.type === "VIDEO") && (!input.width || !input.height)) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_ATTACHMENT_REQUIRED,
        "Attachment dimensions are required",
      );
    }

    if ((input.type === "VIDEO" || input.type === "AUDIO") && !input.durationSeconds) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_ATTACHMENT_REQUIRED,
        "Attachment duration is required",
      );
    }
  }

  resolveAttachmentStatus(): {
    status: "PENDING_MODERATION";
    moderationStatus: ContentModerationStatus;
  } {
    return {
      status: "PENDING_MODERATION",
      moderationStatus: "PENDING",
    };
  }

  resolveObjectExtension(fileName: string, mimeType: string): string {
    const trimmed = fileName.trim().toLowerCase();
    if (trimmed.endsWith(".jpg") || trimmed.endsWith(".jpeg")) {
      return ".jpg";
    }
    if (trimmed.endsWith(".png")) {
      return ".png";
    }
    if (trimmed.endsWith(".webp")) {
      return ".webp";
    }
    if (trimmed.endsWith(".mp4")) {
      return ".mp4";
    }
    if (trimmed.endsWith(".mov")) {
      return ".mov";
    }
    if (trimmed.endsWith(".mp3")) {
      return ".mp3";
    }
    if (trimmed.endsWith(".m4a")) {
      return ".m4a";
    }
    if (trimmed.endsWith(".aac")) {
      return ".aac";
    }
    if (trimmed.endsWith(".wav")) {
      return ".wav";
    }

    switch (mimeType) {
      case "image/jpeg":
        return ".jpg";
      case "image/png":
        return ".png";
      case "image/webp":
        return ".webp";
      case "video/mp4":
        return ".mp4";
      case "video/quicktime":
        return ".mov";
      case "audio/mpeg":
        return ".mp3";
      case "audio/mp4":
        return ".m4a";
      case "audio/aac":
        return ".aac";
      case "audio/wav":
        return ".wav";
      default:
        return "";
    }
  }

  private assertMaxSize(type: "IMAGE" | "VIDEO" | "AUDIO", sizeBytes: number): void {
    const maxBytes =
      type === "IMAGE"
        ? IMAGE_MAX_SIZE_BYTES
        : type === "VIDEO"
          ? VIDEO_MAX_SIZE_BYTES
          : AUDIO_MAX_SIZE_BYTES;

    if (sizeBytes > maxBytes) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_ATTACHMENT_TOO_LARGE,
        "Attachment exceeds the supported size",
      );
    }
  }
}
