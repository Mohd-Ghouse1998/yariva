
import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { AuditLogService } from "../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { resolveConversationPreview } from "../../common/utils/message-visibility.util";
import {
  resolveVisibleAttachment,
  resolveVisibleTextBody,
} from "../../common/utils/message-visibility.util";
import { PrismaService } from "../../database/prisma/prisma.service";
import type { Message, Prisma } from "../../generated/prisma/client";
import { ObjectStorageService } from "../../integrations/object-storage/object-storage.service";
import type { MessageDto } from "../../modules/conversations/dto/conversations.dto";
import { MESSAGE_EVENTS } from "../../modules/messages/events/messages.events";

interface AttachmentModerationResult {
  message: Message;
  conversationId: string;
  participantIds: string[];
  deletedAt: Date | null;
  approved: boolean;
}

@Injectable()
export class MessageAttachmentModerationProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async process(job: Job): Promise<void> {
    const data =
      typeof job.data === "object" && job.data !== null
        ? (job.data as Record<string, unknown>)
        : {};
    if (typeof data.messageId !== "string") {
      return;
    }

    const approved = resolveModerationDecision(data);
    const result = await this.prisma.$transaction((tx) =>
      this.applyModerationResult(tx, {
        messageId: data.messageId as string,
        approved,
        reason: typeof data.reason === "string" ? data.reason : null,
        provider: typeof data.provider === "string" ? data.provider : null,
      }),
    );

    if (!result) {
      return;
    }

    if (result.approved) {
      await this.domainEventPublisher.publishSafely(MESSAGE_EVENTS.UPDATED, {
        conversationId: result.conversationId,
        recipientUserIds: result.participantIds,
        messageByUserId: await buildMessageByUserId(
          result.message,
          result.participantIds,
          this.objectStorageService,
        ),
      });
      return;
    }

    await this.domainEventPublisher.publishSafely(MESSAGE_EVENTS.DELETED, {
      conversationId: result.conversationId,
      recipientUserIds: result.participantIds,
      messageId: result.message.id,
      sequence: result.message.sequence,
      status: "REMOVED_BY_MODERATION",
      deletedAt: (result.deletedAt ?? new Date()).toISOString(),
    });
  }

  private async applyModerationResult(
    tx: Prisma.TransactionClient,
    input: {
      messageId: string;
      approved: boolean;
      reason: string | null;
      provider: string | null;
    },
  ): Promise<AttachmentModerationResult | null> {
    const message = await tx.message.findUnique({
      where: { id: input.messageId },
      include: {
        conversation: {
          include: {
            members: { select: { userId: true } },
            match: {
              select: {
                userLowId: true,
                userHighId: true,
              },
            },
          },
        },
      },
    });
    if (
      !message ||
      message.deletedAt ||
      message.status !== "PENDING_MODERATION" ||
      message.attachmentModerationStatus !== "PENDING"
    ) {
      return null;
    }

    const now = new Date();
    const updated = await tx.message.update({
      where: { id: message.id },
      data: input.approved
        ? {
            status: "ACTIVE",
            attachmentModerationStatus: "APPROVED",
          }
        : {
            status: "REMOVED_BY_MODERATION",
            attachmentModerationStatus: "REJECTED",
            deletedAt: now,
          },
    });

    if (message.sequence === message.conversation.lastMessageSequence) {
      await refreshConversationSummary(tx, message.conversationId);
    }

    await this.auditLogService.write(
      {
        actorUserId: null,
        action: input.approved
          ? "message.attachment.moderation.approve"
          : "message.attachment.moderation.reject",
        entityType: "Message",
        entityId: message.id,
        targetUserId: message.senderId,
        metadata: {
          conversationId: message.conversationId,
          provider: input.provider,
          reason: input.reason,
        },
      },
      tx,
    );

    return {
      message: updated,
      conversationId: message.conversationId,
      participantIds: message.conversation.match ? [message.conversation.match.userLowId, message.conversation.match.userHighId] : message.conversation.members.map((member) => member.userId),
      deletedAt: input.approved ? null : now,
      approved: input.approved,
    };
  }
}

function resolveModerationDecision(payload: Record<string, unknown>): boolean {
  if (payload.approved === false) {
    return false;
  }

  if (
    payload.decision === "REJECTED" ||
    payload.decision === "REJECT" ||
    payload.moderationStatus === "REJECTED"
  ) {
    return false;
  }

  return true;
}

async function refreshConversationSummary(
  tx: Prisma.TransactionClient,
  conversationId: string,
): Promise<void> {
  const latestVisible = await tx.message.findFirst({
    where: {
      conversationId,
      status: {
        in: ["ACTIVE", "PENDING_MODERATION"],
      },
    },
    orderBy: {
      sequence: "desc",
    },
  });
  const latestSource =
    latestVisible ??
    (await tx.message.findFirst({
      where: {
        conversationId,
      },
      orderBy: {
        sequence: "desc",
      },
    }));

  if (!latestSource) {
    await tx.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessagePreview: null,
        lastMessageType: null,
        lastMessageSentAt: null,
        lastSenderId: null,
      },
    });
    return;
  }

  const preview = resolveConversationPreview(latestSource);
  await tx.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessagePreview: preview.preview,
      lastMessageType: preview.type,
      lastMessageSentAt: preview.sentAt,
      lastSenderId: preview.senderId,
      updatedAt: new Date(),
    },
  });
}

async function buildMessageByUserId(
  message: Message,
  participantIds: string[],
  objectStorageService: ObjectStorageService,
): Promise<Record<string, MessageDto>> {
  const entries = await Promise.all(
    participantIds.map(async (userId) => [
      userId,
      await mapModeratedMessage(message, userId, objectStorageService),
    ] as const),
  );
  return Object.fromEntries(entries);
}

async function mapModeratedMessage(
  message: Message,
  viewerUserId: string,
  objectStorageService: ObjectStorageService,
): Promise<MessageDto> {
  const attachment = resolveVisibleAttachment(message, viewerUserId, () => "");
  if (attachment.objectKey && message.attachmentBucket) {
    attachment.url = `messages/${message.id}/attachment`;
    attachment.objectKey = null;
  }

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    sequence: message.sequence,
    clientMessageId: message.clientMessageId ?? null,
    type: message.type,
    textBody: resolveVisibleTextBody(message),
    attachment,
    status: message.status,
    replyToMessageId: message.replyToMessageId ?? null,
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedAt: message.deletedAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}
