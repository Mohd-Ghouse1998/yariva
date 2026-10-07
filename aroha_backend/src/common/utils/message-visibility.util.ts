import type { ContentModerationStatus, MessageStatus, MessageType } from "../../generated/prisma/client";

export interface MessageVisibilityRecord {
  senderId: string;
  type: MessageType;
  textBody: string | null;
  attachmentObjectKey: string | null;
  attachmentBucket: string | null;
  attachmentMimeType: string | null;
  attachmentSizeBytes: number | null;
  attachmentWidth: number | null;
  attachmentHeight: number | null;
  attachmentDurationSeconds: number | null;
  attachmentModerationStatus: ContentModerationStatus | null;
  status: MessageStatus;
  createdAt: Date;
}

export interface VisibleAttachmentView {
  objectKey: string | null;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  moderationStatus: ContentModerationStatus | null;
}

export interface ConversationPreviewView {
  preview: string | null;
  type: MessageType;
  sentAt: Date;
  senderId: string;
}

const REMOVED_MESSAGE_PREVIEW = "Message removed";
const PENDING_ATTACHMENT_PREVIEW = "Attachment pending review";

export function resolveVisibleTextBody(
  message: MessageVisibilityRecord,
): string | null {
  if (isTombstoned(message.status)) {
    return null;
  }

  return message.textBody ?? null;
}

export function resolveVisibleAttachment(
  message: MessageVisibilityRecord,
  viewerUserId: string,
  resolveAttachmentUrl: (bucket: string, objectKey: string) => string,
): VisibleAttachmentView {
  const moderationStatus = message.attachmentModerationStatus ?? null;
  const isVisible =
    !isTombstoned(message.status) &&
    message.attachmentObjectKey !== null &&
    message.attachmentBucket !== null &&
    (moderationStatus === null ||
      moderationStatus === "APPROVED" ||
      (moderationStatus === "PENDING" && message.senderId === viewerUserId));

  if (!isVisible) {
    return {
      objectKey: null,
      url: null,
      mimeType: null,
      sizeBytes: null,
      width: null,
      height: null,
      durationSeconds: null,
      moderationStatus,
    };
  }

  return {
    objectKey: message.attachmentObjectKey,
    url: buildAttachmentUrl(
      message.attachmentBucket,
      message.attachmentObjectKey,
      resolveAttachmentUrl,
    ),
    mimeType: message.attachmentMimeType ?? null,
    sizeBytes: message.attachmentSizeBytes ?? null,
    width: message.attachmentWidth ?? null,
    height: message.attachmentHeight ?? null,
    durationSeconds: message.attachmentDurationSeconds ?? null,
    moderationStatus,
  };
}

export function resolveConversationPreview(
  message: MessageVisibilityRecord,
): ConversationPreviewView {
  if (isTombstoned(message.status)) {
    return {
      preview: REMOVED_MESSAGE_PREVIEW,
      type: message.type,
      sentAt: message.createdAt,
      senderId: message.senderId,
    };
  }

  switch (message.type) {
    case "TEXT":
      return {
        preview: truncatePreview(message.textBody),
        type: message.type,
        sentAt: message.createdAt,
        senderId: message.senderId,
      };
    case "IMAGE":
      return {
        preview:
          message.attachmentModerationStatus === "PENDING"
            ? PENDING_ATTACHMENT_PREVIEW
            : "Photo",
        type: message.type,
        sentAt: message.createdAt,
        senderId: message.senderId,
      };
    case "VIDEO":
      return {
        preview:
          message.attachmentModerationStatus === "PENDING"
            ? PENDING_ATTACHMENT_PREVIEW
            : "Video",
        type: message.type,
        sentAt: message.createdAt,
        senderId: message.senderId,
      };
    case "AUDIO":
      return {
        preview:
          message.attachmentModerationStatus === "PENDING"
            ? PENDING_ATTACHMENT_PREVIEW
            : "Audio",
        type: message.type,
        sentAt: message.createdAt,
        senderId: message.senderId,
      };
    case "SYSTEM":
      return {
        preview: truncatePreview(message.textBody),
        type: message.type,
        sentAt: message.createdAt,
        senderId: message.senderId,
      };
  }
}

export function isTombstoned(status: MessageStatus): boolean {
  return status === "DELETED_BY_SENDER" || status === "REMOVED_BY_MODERATION";
}

function buildAttachmentUrl(
  bucket: string | null,
  objectKey: string | null,
  resolveAttachmentUrl: (bucket: string, objectKey: string) => string,
): string | null {
  if (!bucket || !objectKey) {
    return null;
  }

  return resolveAttachmentUrl(bucket, objectKey);
}

function truncatePreview(value: string | null, maxLength = 160): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}
