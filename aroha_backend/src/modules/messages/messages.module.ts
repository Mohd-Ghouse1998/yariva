import { Module } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { AuditLogService } from "../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { UsersModule } from "../users/users.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { MessagesController } from "./controllers/messages.controller";
import {
  ConversationMessageSummaryService,
  DeleteMessageService,
  EditMessageService,
  EmitTypingIndicatorService,
  FinalizeAttachmentMessageService,
  InitiateMessageAttachmentUploadService,
  MessageDispatchService,
  MessageReaderService,
  SendMessageService,
} from "./application/messages.services";
import {
  AttachmentPolicyService,
  MessagePolicyService,
  MessageSequenceService,
} from "./domain/messages.domain";
import {
  MessageAttachmentUploadStateStore,
  MessageInteractionRepository,
  MessageRepository,
} from "./infrastructure/messages.infrastructure";
import { ConversationMessagePolicy } from "./policies/conversation-message.policy";
import { MessageSenderPolicy } from "./policies/message-sender.policy";
import { ReadMessageAttachmentService } from "./application/read-message-attachment.service";

@Module({
  imports: [UsersModule, ConversationsModule],
  controllers: [MessagesController],
  providers: [
    AppLogger,
    AuditLogService,
    DomainEventPublisher,
    MessageReaderService,
    ReadMessageAttachmentService,
    MessageDispatchService,
    ConversationMessageSummaryService,
    InitiateMessageAttachmentUploadService,
    SendMessageService,
    FinalizeAttachmentMessageService,
    EditMessageService,
    DeleteMessageService,
    EmitTypingIndicatorService,
    MessagePolicyService,
    MessageSequenceService,
    AttachmentPolicyService,
    MessageRepository,
    MessageInteractionRepository,
    MessageAttachmentUploadStateStore,
    MessageSenderPolicy,
    ConversationMessagePolicy,
  ],
  exports: [MessageReaderService, MessageDispatchService, EmitTypingIndicatorService],
})
export class MessagesModule {}
