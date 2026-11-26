import { conversationParticipantIds as resolveParticipantIds } from "../../conversations/domain/conversation-context";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import objectStorageConfig from "../../../config/object-storage.config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import { randomBase64Url } from "../../../common/utils/crypto.util";
import {
  resolveConversationPreview,
  resolveVisibleAttachment,
  resolveVisibleTextBody,
} from "../../../common/utils/message-visibility.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import { BullmqProducer } from "../../../integrations/bullmq/bullmq.producer";
import type { Message } from "../../../generated/prisma/client";
import { SocialNoticeService } from "../../social/social-notice.service";
import { UserReaderService } from "../../users/application/users.services";
import { UserRepository } from "../../users/infrastructure/users.infrastructure";
import type { MessageDto } from "../../conversations/dto/conversations.dto";
import {
  ConversationReadRepository,
  ConversationRepository,
  type ConversationProjection,
} from "../../conversations/infrastructure/conversations.infrastructure";
import {
  AttachmentPolicyService,
  MessagePolicyService,
  MessageSequenceService,
} from "../domain/messages.domain";
import type {
  CreateConversationMessageDto,
  FinalizeMessageAttachmentDto,
  InitiateMessageAttachmentUploadDto,
  InitiateMessageAttachmentUploadResponseDto,
  MessageResponseDto,
  UpdateMessageDto,
} from "../dto/messages.dto";
import { MESSAGE_EVENTS } from "../events/messages.events";
import {
  MessageAttachmentUploadStateStore,
  MessageInteractionRepository,
  MessageRepository,
} from "../infrastructure/messages.infrastructure";

const MESSAGE_ATTACHMENT_UPLOAD_TTL_SECONDS = 15 * 60;

export interface MessageActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

interface MessageEventPayloadByUser {
  [userId: string]: MessageDto;
}

@Injectable()
export class MessageReaderService {
  constructor(
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async mapMessage(message: Message, viewerUserId: string): Promise<MessageDto> {
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
}

@Injectable()
export class MessageDispatchService {
  constructor(
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async emitCreated(input: {
    conversationId: string;
    recipientUserIds: string[];
    messageByUserId: MessageEventPayloadByUser;
    inAppOnly?: boolean;
  }): Promise<void> {
    await this.domainEventPublisher.publishSafely(MESSAGE_EVENTS.CREATED, input);
  }

  async emitUpdated(input: {
    conversationId: string;
    recipientUserIds: string[];
    messageByUserId: MessageEventPayloadByUser;
  }): Promise<void> {
    await this.domainEventPublisher.publishSafely(MESSAGE_EVENTS.UPDATED, input);
  }

  async emitDeleted(input: {
    conversationId: string;
    recipientUserIds: string[];
    messageId: string;
    sequence: number;
    status: "DELETED_BY_SENDER" | "REMOVED_BY_MODERATION";
    deletedAt: string;
  }): Promise<void> {
    await this.domainEventPublisher.publishSafely(MESSAGE_EVENTS.DELETED, input);
  }

  async emitTyping(input: {
    conversationId: string;
    userId: string;
    recipientUserIds: string[];
    isTyping: boolean;
    expiresAt: string;
  }): Promise<void> {
    await this.domainEventPublisher.publishSafely(MESSAGE_EVENTS.TYPING, input);
  }
}

@Injectable()
export class ConversationMessageSummaryService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
  ) {}

  async recompute(
    executor: import("../../../database/prisma/prisma.transaction").PrismaTransactionalClient,
    conversationId: string,
  ): Promise<void> {
    const latestVisible = await this.messageRepository.findLatestVisibleByConversation(
      conversationId,
      executor,
    );
    const latestSource =
      latestVisible ??
      (await this.messageRepository.findLatestByConversation(
        conversationId,
        executor,
      ));

    if (!latestSource) {
      await this.conversationRepository.updateSummary(executor, {
        conversationId,
        lastMessagePreview: null,
        lastMessageType: null,
        lastMessageSentAt: null,
        lastSenderId: null,
      });
      return;
    }

    const preview = resolveConversationPreview(latestSource);
    await this.conversationRepository.updateSummary(executor, {
      conversationId,
      lastMessagePreview: preview.preview,
      lastMessageType: preview.type,
      lastMessageSentAt: preview.sentAt,
      lastSenderId: preview.senderId,
    });
  }
}

@Injectable()
export class InitiateMessageAttachmentUploadService {
  constructor(
    private readonly userReaderService: UserReaderService,
    private readonly conversationRepository: ConversationRepository,
    private readonly messageInteractionRepository: MessageInteractionRepository,
    private readonly messagePolicyService: MessagePolicyService,
    private readonly attachmentPolicyService: AttachmentPolicyService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly attachmentUploadStateStore: MessageAttachmentUploadStateStore,
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
    private readonly bullmqProducer: BullmqProducer,
  ) {}

  async execute(input: {
    userId: string;
    payload: InitiateMessageAttachmentUploadDto;
  }): Promise<InitiateMessageAttachmentUploadResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.attachmentPolicyService.assertUploadAllowed(input.payload);

    const conversation = await this.getWritableConversation(
      input.payload.conversationId,
      input.userId,
    );

    const uploadToken = randomBase64Url(32);
    await this.conversationRepository.assertMediaSharingAllowed(conversation.matchId);
    const objectKey = buildMessageAttachmentObjectKey(
      input.userId,
      input.payload.conversationId,
      input.payload.fileName,
      input.payload.mimeType,
      this.attachmentPolicyService,
    );

    const instruction = await this.objectStorageService.createPresignedPutObject({
      bucket: this.storageConfig.bucketMessageAttachments,
      objectKey,
      mimeType: input.payload.mimeType,
      uploadToken,
      userId: input.userId,
      sha256: input.payload.sha256 ?? null,
      expiresInSeconds: MESSAGE_ATTACHMENT_UPLOAD_TTL_SECONDS,
    });

    await this.attachmentUploadStateStore.save(
      {
        userId: input.userId,
        conversationId: conversation.id,
        uploadToken,
        bucket: this.storageConfig.bucketMessageAttachments,
        objectKey,
        fileName: input.payload.fileName,
        mimeType: input.payload.mimeType,
        sizeBytes: input.payload.sizeBytes,
        sha256: input.payload.sha256 ?? null,
        expiresAt: instruction.expiresAt.toISOString(),
      },
      MESSAGE_ATTACHMENT_UPLOAD_TTL_SECONDS,
    );

    if (conversation.circleId) {
      await this.bullmqProducer.enqueue("message.attachment.cleanup", {
        conversationId: conversation.id,
        objectKey,
        bucket: this.storageConfig.bucketMessageAttachments,
        expiresAt: instruction.expiresAt.toISOString(),
      }, { delayMs: instruction.expiresAt.getTime() - Date.now() + 60 * 60 * 1000 });
    }

    return {
      uploadToken,
      objectKey,
      bucket: this.storageConfig.bucketMessageAttachments,
      method: "PUT",
      uploadUrl: instruction.uploadUrl,
      headers: instruction.headers,
      expiresAt: instruction.expiresAt.toISOString(),
    };
  }

  private async getWritableConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationProjection> {
    const conversation = await this.conversationRepository.findByIdForUser(
      conversationId,
      userId,
    );
    const participantIds = resolveParticipantIds(conversation);
    const otherUserId = participantIds.find((id) => id !== userId) ?? userId;
    const blocked = conversation
      ? await this.messageInteractionRepository.hasActiveBlockAmong(resolveParticipantIds(conversation), )
      : false;

    this.messagePolicyService.assertConversationWritable(
      conversation,
      userId,
      blocked,
    );

    return conversation;
  }
}

@Injectable()
export class SendMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly userRepository: UserRepository,
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationReadRepository: ConversationReadRepository,
    private readonly messageRepository: MessageRepository,
    private readonly messageInteractionRepository: MessageInteractionRepository,
    private readonly messagePolicyService: MessagePolicyService,
    private readonly messageSequenceService: MessageSequenceService,
    private readonly messageReaderService: MessageReaderService,
    private readonly messageDispatchService: MessageDispatchService,
    private readonly auditLogService: AuditLogService,
    private readonly socialNotices: SocialNoticeService,
  ) {}

  async execute(input: {
    userId: string;
    conversationId: string;
    payload: CreateConversationMessageDto;
    metadata: MessageActionMetadata;
  }): Promise<MessageResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.messagePolicyService.assertTextBody(input.payload.textBody);

    const existing = await this.messageRepository.findByConversationAndClientMessageId(
      input.conversationId,
      input.userId,
      input.payload.clientMessageId,
    );
    if (existing) {
      const replayConversation = await this.conversationRepository.findByIdForUser(input.conversationId, input.userId);
      this.messagePolicyService.assertConversationWritable(replayConversation, input.userId,
        await this.messageInteractionRepository.hasActiveBlockAmong(resolveParticipantIds(replayConversation)));
      return { message: await this.messageReaderService.mapMessage(existing, input.userId) };
    }

    const now = new Date();

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const conversation = await this.conversationRepository.findByIdForUser(
          input.conversationId,
          input.userId,
          tx,
        );
        const participantIds = resolveParticipantIds(conversation);
        const otherUserId = participantIds.find((id) => id !== input.userId) ?? input.userId;
        const blocked = conversation
          ? await this.messageInteractionRepository.hasActiveBlockAmong(resolveParticipantIds(conversation), tx)
          : false;

        this.messagePolicyService.assertConversationWritable(
          conversation,
          input.userId,
          blocked,
        );

        const duplicate =
          await this.messageRepository.findByConversationAndClientMessageId(
            input.conversationId,
            input.userId,
            input.payload.clientMessageId,
            tx,
          );
        if (duplicate) {
          return {
            message: duplicate,
            participantIds,
            created: false,
          };
        }

        if (input.payload.replyToMessageId) {
          const replyTarget = await this.messageRepository.findByConversationAndId(
            input.conversationId,
            input.payload.replyToMessageId,
            tx,
          );
          this.messagePolicyService.assertReplyTargetBelongsToConversation(
            replyTarget,
            input.conversationId,
          );
        }

        const previewSource = {
          senderId: input.userId,
          type: "TEXT" as const,
          textBody: input.payload.textBody,
          attachmentObjectKey: null,
          attachmentBucket: null,
          attachmentMimeType: null,
          attachmentSizeBytes: null,
          attachmentWidth: null,
          attachmentHeight: null,
          attachmentDurationSeconds: null,
          attachmentModerationStatus: null,
          status: "ACTIVE" as const,
          createdAt: now,
        };
        const preview = resolveConversationPreview(previewSource);
        const advanced = await this.conversationRepository.advanceForNewMessage(tx, {
          conversationId: input.conversationId,
          lastMessagePreview: preview.preview,
          lastMessageType: preview.type,
          lastMessageSentAt: preview.sentAt,
          lastSenderId: preview.senderId,
        });

        const sequence = advanced.lastMessageSequence;
        const message = await this.messageRepository.create(tx, {
          conversationId: input.conversationId,
          senderId: input.userId,
          sequence,
          clientMessageId: input.payload.clientMessageId,
          type: "TEXT",
          textBody: input.payload.textBody.trim(),
          replyToMessageId: input.payload.replyToMessageId ?? null,
        });

        await this.conversationReadRepository.updateReadState(tx, {
          conversationId: input.conversationId,
          userId: input.userId,
          lastReadMessageId: message.id,
          lastReadSequence: sequence,
          lastReadAt: now,
        });

        await this.userRepository.touchLastActiveAt(input.userId, now, tx);

        await this.auditLogService.write(
          {
            actorUserId: input.userId,
            action: "message.send",
            entityType: "Message",
            entityId: message.id,
            targetUserId: otherUserId,
            ipAddress: input.metadata.ipAddress,
            userAgent: input.metadata.userAgent,
            metadata: {
              conversationId: input.conversationId,
              sequence,
            },
          },
          tx,
        );

        const notices = conversation.circleId ? await this.socialNotices.persist(tx, {
          route: "circle-message", conversationId: conversation.id, messageId: message.id,
        }, participantIds.filter((id) => id !== input.userId)) : [];
        return {
          message,
          participantIds,
          notices,
          inAppOnly: Boolean(conversation.circleId),
          created: true,
        };
      });

      if (result.created) {
        if (result.notices) await this.socialNotices.dispatch(result.notices);
        await this.messageDispatchService.emitCreated({
          ...(result.inAppOnly ? { inAppOnly: true } : {}),
          conversationId: result.message.conversationId,
          recipientUserIds: result.participantIds,
          messageByUserId: await buildMessageByUserId(
            result.message,
            result.participantIds,
            this.messageReaderService,
          ),
        });
      }

      return {
        message: await this.messageReaderService.mapMessage(result.message, input.userId),
      };
    } catch (error) {
      if (this.messageRepository.isUniqueConstraintError(error)) {
        const duplicate =
          await this.messageRepository.findByConversationAndClientMessageId(
            input.conversationId,
            input.userId,
            input.payload.clientMessageId,
          );
        if (duplicate) {
          return {
            message: await this.messageReaderService.mapMessage(duplicate, input.userId),
          };
        }
      }

      throw error;
    }
  }
}

@Injectable()
export class FinalizeAttachmentMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly userRepository: UserRepository,
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationReadRepository: ConversationReadRepository,
    private readonly messageRepository: MessageRepository,
    private readonly messageInteractionRepository: MessageInteractionRepository,
    private readonly messagePolicyService: MessagePolicyService,
    private readonly attachmentPolicyService: AttachmentPolicyService,
    private readonly messageReaderService: MessageReaderService,
    private readonly messageDispatchService: MessageDispatchService,
    private readonly attachmentUploadStateStore: MessageAttachmentUploadStateStore,
    private readonly objectStorageService: ObjectStorageService,
    private readonly bullmqProducer: BullmqProducer,
    private readonly auditLogService: AuditLogService,
    private readonly socialNotices: SocialNoticeService,
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
  ) {}

  async execute(input: {
    userId: string;
    payload: FinalizeMessageAttachmentDto;
    metadata: MessageActionMetadata;
  }): Promise<MessageResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.attachmentPolicyService.assertFinalizeAllowed(input.payload);

    const currentConversation = await this.conversationRepository.findByIdForUser(input.payload.conversationId, input.userId);
    this.messagePolicyService.assertConversationWritable(currentConversation, input.userId,
      await this.messageInteractionRepository.hasActiveBlockAmong(resolveParticipantIds(currentConversation)));

    const existing = await this.messageRepository.findByConversationAndClientMessageId(
      input.payload.conversationId,
      input.userId,
      input.payload.clientMessageId,
    );
    if (existing) {
      return { message: await this.messageReaderService.mapMessage(existing, input.userId) };
    }

    const uploadState = await this.attachmentUploadStateStore.get(
      input.payload.uploadToken,
    );
    if (!uploadState) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_ATTACHMENT_UPLOAD_INVALID,
        "Attachment upload is invalid or expired",
      );
    }

    if (input.payload.bucket !== this.storageConfig.bucketMessageAttachments) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_ATTACHMENT_UPLOAD_INVALID,
        "Attachment bucket is invalid",
      );
    }

    assertAttachmentUploadMatches(uploadState, input.userId, input.payload);

    const headedObject = await this.objectStorageService.headObject({
      bucket: input.payload.bucket,
      objectKey: input.payload.objectKey,
    });
    assertHeadedAttachmentMatches(headedObject, uploadState, input.payload);

    const now = new Date();

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const conversation = await this.conversationRepository.findByIdForUser(
          input.payload.conversationId,
          input.userId,
          tx,
        );
        const participantIds = resolveParticipantIds(conversation);
        const otherUserId = participantIds.find((id) => id !== input.userId) ?? input.userId;
        const blocked = conversation
          ? await this.messageInteractionRepository.hasActiveBlockAmong(resolveParticipantIds(conversation), tx)
          : false;

        this.messagePolicyService.assertConversationWritable(
          conversation,
          input.userId,
          blocked,
        );

        const duplicate =
          await this.messageRepository.findByConversationAndClientMessageId(
            input.payload.conversationId,
            input.userId,
            input.payload.clientMessageId,
            tx,
          );
        await this.conversationRepository.assertMediaSharingAllowed(conversation.matchId, tx);
        if (duplicate) {
          return {
            message: duplicate,
            participantIds,
            created: false,
          };
        }
        if (conversation.circleId && Date.parse(uploadState.expiresAt) <= Date.now()) {
          throw new AppException(400, ERROR_CODES.MESSAGE_ATTACHMENT_UPLOAD_INVALID, "Attachment upload is invalid or expired");
        }

        if (input.payload.replyToMessageId) {
          const replyTarget = await this.messageRepository.findByConversationAndId(
            input.payload.conversationId,
            input.payload.replyToMessageId,
            tx,
          );
          this.messagePolicyService.assertReplyTargetBelongsToConversation(
            replyTarget,
            input.payload.conversationId,
          );
        }

        const status = this.attachmentPolicyService.resolveAttachmentStatus();
        const previewSource = {
          senderId: input.userId,
          type: input.payload.type,
          textBody: null,
          attachmentObjectKey: input.payload.objectKey,
          attachmentBucket: input.payload.bucket,
          attachmentMimeType: input.payload.mimeType,
          attachmentSizeBytes: input.payload.sizeBytes,
          attachmentWidth: input.payload.width ?? null,
          attachmentHeight: input.payload.height ?? null,
          attachmentDurationSeconds: input.payload.durationSeconds ?? null,
          attachmentModerationStatus: status.moderationStatus,
          status: status.status,
          createdAt: now,
        };
        const preview = resolveConversationPreview(previewSource);
        const advanced = await this.conversationRepository.advanceForNewMessage(tx, {
          conversationId: input.payload.conversationId,
          lastMessagePreview: preview.preview,
          lastMessageType: preview.type,
          lastMessageSentAt: preview.sentAt,
          lastSenderId: preview.senderId,
        });

        const message = await this.messageRepository.create(tx, {
          conversationId: input.payload.conversationId,
          senderId: input.userId,
          sequence: advanced.lastMessageSequence,
          clientMessageId: input.payload.clientMessageId,
          type: input.payload.type,
          textBody: null,
          attachmentObjectKey: input.payload.objectKey,
          attachmentBucket: input.payload.bucket,
          attachmentMimeType: input.payload.mimeType,
          attachmentSizeBytes: input.payload.sizeBytes,
          attachmentWidth: input.payload.width ?? null,
          attachmentHeight: input.payload.height ?? null,
          attachmentDurationSeconds: input.payload.durationSeconds ?? null,
          attachmentModerationStatus: status.moderationStatus,
          status: status.status,
          replyToMessageId: input.payload.replyToMessageId ?? null,
        });

        await this.conversationReadRepository.updateReadState(tx, {
          conversationId: input.payload.conversationId,
          userId: input.userId,
          lastReadMessageId: message.id,
          lastReadSequence: message.sequence,
          lastReadAt: now,
        });

        await this.userRepository.touchLastActiveAt(input.userId, now, tx);

        await this.auditLogService.write(
          {
            actorUserId: input.userId,
            action: "message.attachment.finalize",
            entityType: "Message",
            entityId: message.id,
            targetUserId: otherUserId,
            ipAddress: input.metadata.ipAddress,
            userAgent: input.metadata.userAgent,
            metadata: {
              conversationId: input.payload.conversationId,
              objectKey: input.payload.objectKey,
              type: input.payload.type,
            },
          },
          tx,
        );

        const notices = conversation.circleId ? await this.socialNotices.persist(tx, {
          route: "circle-message", conversationId: conversation.id, messageId: message.id,
        }, participantIds.filter((id) => id !== input.userId)) : [];
        return {
          message,
          participantIds,
          notices,
          inAppOnly: Boolean(conversation.circleId),
          created: true,
        };
      });

      await this.attachmentUploadStateStore.delete(input.payload.uploadToken);

      if (result.created) {
        if (result.notices) await this.socialNotices.dispatch(result.notices);
        await this.enqueueAttachmentModerationSafely(result.message.id);
        await this.messageDispatchService.emitCreated({
          ...(result.inAppOnly ? { inAppOnly: true } : {}),
          conversationId: result.message.conversationId,
          recipientUserIds: result.participantIds,
          messageByUserId: await buildMessageByUserId(
            result.message,
            result.participantIds,
            this.messageReaderService,
          ),
        });
      }

      return {
        message: await this.messageReaderService.mapMessage(result.message, input.userId),
      };
    } catch (error) {
      if (this.messageRepository.isUniqueConstraintError(error)) {
        const duplicate =
          await this.messageRepository.findByConversationAndClientMessageId(
            input.payload.conversationId,
            input.userId,
            input.payload.clientMessageId,
          );
        if (duplicate) {
          await this.attachmentUploadStateStore.delete(input.payload.uploadToken);
          return {
            message: await this.messageReaderService.mapMessage(duplicate, input.userId),
          };
        }
      }

      throw error;
    }
  }

  private async enqueueAttachmentModerationSafely(messageId: string): Promise<void> {
    try {
      await this.bullmqProducer.enqueue(
        "message.attachment.moderation",
        { messageId },
        { jobId: `message.attachment.moderation:${messageId}` },
      );
    } catch {
      return;
    }
  }
}

@Injectable()
export class EditMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageRepository: MessageRepository,
    private readonly messageInteractionRepository: MessageInteractionRepository,
    private readonly messagePolicyService: MessagePolicyService,
    private readonly messageReaderService: MessageReaderService,
    private readonly messageDispatchService: MessageDispatchService,
    private readonly conversationSummaryService: ConversationMessageSummaryService,
    private readonly auditLogService: AuditLogService,
    private readonly conversationRepository?: ConversationRepository,
  ) {}

  async execute(input: {
    userId: string;
    messageId: string;
    payload: UpdateMessageDto;
    metadata: MessageActionMetadata;
  }): Promise<MessageResponseDto> {
    this.messagePolicyService.assertTextBody(input.payload.textBody);

    const initial = await this.messageRepository.findAccessRecordById(input.messageId);
    const now = new Date();
    this.messagePolicyService.assertEditable(initial, input.userId, now);

    const otherUserId = resolveParticipantIds(initial.conversation).find((id) => id !== input.userId) ?? input.userId;
    const blocked = await this.messageInteractionRepository.hasActiveBlockAmong(resolveParticipantIds(initial.conversation));
    this.messagePolicyService.assertConversationWritable(
      initial.conversation,
      input.userId,
      blocked,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.messageRepository.findAccessRecordById(
        input.messageId,
        tx,
      );
      if (current?.conversation.circleId &&
          !await this.conversationRepository?.findByIdForUser(current.conversation.id, input.userId, tx)) {
        throw new AppException(404, ERROR_CODES.CONVERSATION_NOT_FOUND, "Conversation not found");
      }
      this.messagePolicyService.assertEditable(current, input.userId, now);
      const txOtherUserId = resolveParticipantIds(current.conversation).find((id) => id !== input.userId) ?? input.userId;
      const txBlocked = await this.messageInteractionRepository.hasActiveBlockAmong(resolveParticipantIds(current.conversation), tx);
      this.messagePolicyService.assertConversationWritable(
        current.conversation,
        input.userId,
        txBlocked,
      );

      const updated = await this.messageRepository.updateText(tx, {
        messageId: input.messageId,
        textBody: input.payload.textBody.trim(),
        editedAt: now,
      });

      await this.conversationSummaryService.recompute(
        tx,
        updated.conversationId,
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "message.edit",
          entityType: "Message",
          entityId: updated.id,
          targetUserId: txOtherUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            conversationId: updated.conversationId,
          },
        },
        tx,
      );

      return {
        message: updated,
        participantIds: resolveParticipantIds(current!.conversation),
      };
    });

    await this.messageDispatchService.emitUpdated({
      conversationId: result.message.conversationId,
      recipientUserIds: result.participantIds,
      messageByUserId: await buildMessageByUserId(
        result.message,
        result.participantIds,
        this.messageReaderService,
      ),
    });

    return {
      message: await this.messageReaderService.mapMessage(result.message, input.userId),
    };
  }
}

@Injectable()
export class DeleteMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageRepository: MessageRepository,
    private readonly messagePolicyService: MessagePolicyService,
    private readonly conversationSummaryService: ConversationMessageSummaryService,
    private readonly messageDispatchService: MessageDispatchService,
    private readonly auditLogService: AuditLogService,
    private readonly conversationRepository?: ConversationRepository,
  ) {}

  async execute(input: {
    userId: string;
    messageId: string;
    metadata: MessageActionMetadata;
  }): Promise<void> {
    const existing = await this.messageRepository.findAccessRecordById(input.messageId);
    this.messagePolicyService.assertDeletable(existing, input.userId);

    const deletedAt = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.messageRepository.findAccessRecordById(
        input.messageId,
        tx,
      );
      if (current?.conversation.circleId &&
          !await this.conversationRepository?.findByIdForUser(current.conversation.id, input.userId, tx)) {
        throw new AppException(404, ERROR_CODES.CONVERSATION_NOT_FOUND, "Conversation not found");
      }
      this.messagePolicyService.assertDeletable(current, input.userId);
      if (current.conversation.duoMatchId || current.conversation.circleId) {
        const ids = resolveParticipantIds(current.conversation);
        const blocked = await tx.block.count({ where: {
          deletedAt: null, blockerId: { in: ids }, blockedId: { in: ids },
        } });
        this.messagePolicyService.assertConversationWritable(current.conversation, input.userId, blocked > 0);
      }

      const deleted = await this.messageRepository.markDeleted(tx, {
        messageId: input.messageId,
        deletedAt,
      });

      await this.conversationSummaryService.recompute(
        tx,
        deleted.conversationId,
      );

      const otherUserId = resolveParticipantIds(current!.conversation).find((id) => id !== input.userId) ?? input.userId;
      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "message.delete",
          entityType: "Message",
          entityId: deleted.id,
          targetUserId: otherUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            conversationId: deleted.conversationId,
            sequence: deleted.sequence,
          },
        },
        tx,
      );

      return {
        deleted,
        participantIds: resolveParticipantIds(current!.conversation),
      };
    });

    await this.messageDispatchService.emitDeleted({
      conversationId: result.deleted.conversationId,
      recipientUserIds: result.participantIds,
      messageId: result.deleted.id,
      sequence: result.deleted.sequence,
      status: "DELETED_BY_SENDER",
      deletedAt: result.deleted.deletedAt?.toISOString() ?? deletedAt.toISOString(),
    });
  }
}

@Injectable()
export class EmitTypingIndicatorService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageInteractionRepository: MessageInteractionRepository,
    private readonly messagePolicyService: MessagePolicyService,
  ) {}

  async execute(input: {
    userId: string;
    conversationId: string;
  }): Promise<{
    recipientUserIds: string[];
  }> {
    const conversation = await this.conversationRepository.findByIdForUser(
      input.conversationId,
      input.userId,
    );
    const participantIds = resolveParticipantIds(conversation);
    const otherUserId = participantIds.find((id) => id !== input.userId) ?? input.userId;
    const blocked = conversation
      ? await this.messageInteractionRepository.hasActiveBlockAmong(resolveParticipantIds(conversation), )
      : false;

    this.messagePolicyService.assertConversationWritable(
      conversation,
      input.userId,
      blocked,
    );

    return {
      recipientUserIds: participantIds.filter((id) => id !== input.userId),
    };
  }
}

function buildMessageAttachmentObjectKey(
  userId: string,
  conversationId: string,
  fileName: string,
  mimeType: string,
  attachmentPolicyService: AttachmentPolicyService,
): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const extension = attachmentPolicyService.resolveObjectExtension(
    fileName,
    mimeType,
  );

  return `${conversationId}/${userId}/${year}/${month}/${randomUUID()}${extension}`;
}

async function buildMessageByUserId(
  message: Message,
  participantIds: string[],
  messageReaderService: MessageReaderService,
): Promise<MessageEventPayloadByUser> {
  const entries = await Promise.all(
    participantIds.map(async (userId) => [
      userId,
      await messageReaderService.mapMessage(message, userId),
    ] as const),
  );
  return Object.fromEntries(entries);
}

function assertAttachmentUploadMatches(
  uploadState: {
    userId: string;
    conversationId: string;
    bucket: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string | null;
  },
  userId: string,
  payload: FinalizeMessageAttachmentDto,
): void {
  if (
    uploadState.userId !== userId ||
    uploadState.conversationId !== payload.conversationId ||
    uploadState.bucket !== payload.bucket ||
    uploadState.objectKey !== payload.objectKey ||
    uploadState.mimeType !== payload.mimeType ||
    uploadState.sizeBytes !== payload.sizeBytes
  ) {
    throw new AppException(
      400,
      ERROR_CODES.MESSAGE_ATTACHMENT_UPLOAD_INVALID,
      "Attachment upload does not match the initiated upload",
    );
  }
}

function assertHeadedAttachmentMatches(
  head: {
    sizeBytes: number | null;
    mimeType: string | null;
    metadata: Record<string, string>;
  },
  uploadState: {
    uploadToken: string;
    userId: string;
    sha256: string | null;
  },
  payload: FinalizeMessageAttachmentDto,
): void {
  if (head.sizeBytes !== payload.sizeBytes || head.mimeType !== payload.mimeType) {
    throw new AppException(
      400,
      ERROR_CODES.MESSAGE_ATTACHMENT_UPLOAD_INVALID,
      "Uploaded attachment metadata does not match the expected file",
    );
  }

  if (
    head.metadata["aroha-user-id"] !== uploadState.userId ||
    head.metadata["aroha-upload-token"] !== uploadState.uploadToken
  ) {
    throw new AppException(
      400,
      ERROR_CODES.MESSAGE_ATTACHMENT_UPLOAD_INVALID,
      "Uploaded attachment ownership metadata is invalid",
    );
  }

  if ((uploadState.sha256 ?? null) !== (head.metadata["aroha-sha256"] ?? null)) {
    throw new AppException(
      400,
      ERROR_CODES.MESSAGE_ATTACHMENT_UPLOAD_INVALID,
      "Uploaded attachment checksum is invalid",
    );
  }
}
