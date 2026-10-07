import { conversationInclude, lockConversationForMutation, type ConversationProjection } from "../../conversations/infrastructure/conversations.infrastructure";
import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../integrations/redis/redis.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  Conversation,
  Match,
  Message,
  User,
} from "../../../generated/prisma/client";

type MessageExecutor = PrismaService | PrismaTransactionalClient;

export interface MessageAccessRecord extends Message {
  conversation: ConversationProjection;
}

export interface MessageAttachmentUploadIntent {
  userId: string;
  conversationId: string;
  uploadToken: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string | null;
  expiresAt: string;
}

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    messageId: string,
    executor?: MessageExecutor,
  ): Promise<Message | null> {
    const db = executor ?? this.prisma;

    return db.message.findUnique({
      where: {
        id: messageId,
      },
    });
  }

  async findAccessRecordById(
    messageId: string,
    executor?: MessageExecutor,
  ): Promise<MessageAccessRecord | null> {
    const db = executor ?? this.prisma;
    if (executor) {
      const message = await db.message.findUnique({ where: { id: messageId }, select: { conversationId: true } });
      if (!message) return null;
      await lockConversationForMutation(executor, message.conversationId);
    }

    return db.message.findUnique({
      where: {
        id: messageId,
      },
      include: { conversation: { include: conversationInclude() } },
    }) as Promise<MessageAccessRecord | null>;
  }

  async findByConversationAndClientMessageId(
    conversationId: string,
    senderId: string,
    clientMessageId: string,
    executor?: MessageExecutor,
  ): Promise<Message | null> {
    const db = executor ?? this.prisma;

    return db.message.findUnique({
      where: {
        conversationId_senderId_clientMessageId: {
          conversationId,
          senderId,
          clientMessageId,
        },
      },
    });
  }

  async findByConversationAndId(
    conversationId: string,
    messageId: string,
    executor?: MessageExecutor,
  ): Promise<Pick<Message, "id" | "conversationId"> | null> {
    const db = executor ?? this.prisma;

    return db.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      select: {
        id: true,
        conversationId: true,
      },
    });
  }

  async create(
    executor: PrismaTransactionalClient,
    data: {
      conversationId: string;
      senderId: string;
      sequence: number;
      clientMessageId: string;
      type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO";
      textBody: string | null;
      attachmentObjectKey?: string | null;
      attachmentBucket?: string | null;
      attachmentMimeType?: string | null;
      attachmentSizeBytes?: number | null;
      attachmentWidth?: number | null;
      attachmentHeight?: number | null;
      attachmentDurationSeconds?: number | null;
      attachmentModerationStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
      status?: "ACTIVE" | "PENDING_MODERATION";
      replyToMessageId?: string | null;
    },
  ): Promise<Message> {
    return executor.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        sequence: data.sequence,
        clientMessageId: data.clientMessageId,
        type: data.type,
        textBody: data.textBody,
        attachmentObjectKey: data.attachmentObjectKey ?? null,
        attachmentBucket: data.attachmentBucket ?? null,
        attachmentMimeType: data.attachmentMimeType ?? null,
        attachmentSizeBytes: data.attachmentSizeBytes ?? null,
        attachmentWidth: data.attachmentWidth ?? null,
        attachmentHeight: data.attachmentHeight ?? null,
        attachmentDurationSeconds: data.attachmentDurationSeconds ?? null,
        attachmentModerationStatus: data.attachmentModerationStatus ?? null,
        status: data.status ?? "ACTIVE",
        replyToMessageId: data.replyToMessageId ?? null,
      },
    });
  }

  async updateText(
    executor: PrismaTransactionalClient,
    input: {
      messageId: string;
      textBody: string;
      editedAt: Date;
    },
  ): Promise<Message> {
    return executor.message.update({
      where: {
        id: input.messageId,
      },
      data: {
        textBody: input.textBody,
        editedAt: input.editedAt,
      },
    });
  }

  async markDeleted(
    executor: PrismaTransactionalClient,
    input: {
      messageId: string;
      deletedAt: Date;
    },
  ): Promise<Message> {
    return executor.message.update({
      where: {
        id: input.messageId,
      },
      data: {
        status: "DELETED_BY_SENDER",
        deletedAt: input.deletedAt,
      },
    });
  }

  async findLatestByConversation(
    conversationId: string,
    executor?: MessageExecutor,
  ): Promise<Message | null> {
    const db = executor ?? this.prisma;

    return db.message.findFirst({
      where: {
        conversationId,
      },
      orderBy: {
        sequence: "desc",
      },
    });
  }

  async findLatestVisibleByConversation(
    conversationId: string,
    executor?: MessageExecutor,
  ): Promise<Message | null> {
    const db = executor ?? this.prisma;

    return db.message.findFirst({
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
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    );
  }
}

@Injectable()
export class MessageInteractionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hasActiveBlockAmong(userIds: string[], executor?: MessageExecutor): Promise<boolean> {
    const db = executor ?? this.prisma;
    return await db.block.count({ where: { deletedAt: null, blockerId: { in: userIds }, blockedId: { in: userIds } } }) > 0;
  }

  async hasActiveBlockBetween(
    actorId: string,
    targetId: string,
    executor?: MessageExecutor,
  ): Promise<boolean> {
    const db = executor ?? this.prisma;
    const count = await db.block.count({
      where: {
        deletedAt: null,
        OR: [
          {
            blockerId: actorId,
            blockedId: targetId,
          },
          {
            blockerId: targetId,
            blockedId: actorId,
          },
        ],
      },
    });

    return count > 0;
  }
}

@Injectable()
export class MessageAttachmentUploadStateStore {
  private static readonly KEY_PREFIX = "message-attachment-upload:";

  constructor(private readonly redis: RedisService) {}

  async save(
    input: MessageAttachmentUploadIntent,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(
      `${MessageAttachmentUploadStateStore.KEY_PREFIX}${input.uploadToken}`,
      JSON.stringify(input),
      "EX",
      ttlSeconds,
    );
  }

  async get(uploadToken: string): Promise<MessageAttachmentUploadIntent | null> {
    const raw = await this.redis.get(
      `${MessageAttachmentUploadStateStore.KEY_PREFIX}${uploadToken}`,
    );
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as MessageAttachmentUploadIntent;
  }

  async delete(uploadToken: string): Promise<void> {
    await this.redis.del(
      `${MessageAttachmentUploadStateStore.KEY_PREFIX}${uploadToken}`,
    );
  }
}
