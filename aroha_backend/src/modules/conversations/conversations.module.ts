import { Module } from "@nestjs/common";
import { DuoRevocationService } from "./application/duo-revocation.service";
import { AppLogger } from "../../common/logger/app-logger.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { ConversationsController } from "./controllers/conversations.controller";
import {
  ConversationArtifactService,
  ConversationCloserService,
  ConversationReaderService,
  GetConversationService,
  ListConversationMessagesService,
  ListConversationsService,
  MarkConversationReadService,
} from "./application/conversations.services";
import {
  ConversationAccessPolicyService,
  ConversationParticipantPolicy,
  UnreadCounterService,
} from "./domain/conversations.domain";
import {
  ConversationReadRepository,
  ConversationRepository,
  MessageRepository,
} from "./infrastructure/conversations.infrastructure";

@Module({
  controllers: [ConversationsController],
  providers: [
    DuoRevocationService,
    AppLogger,
    DomainEventPublisher,
    ConversationReaderService,
    ConversationArtifactService,
    ConversationCloserService,
    ListConversationsService,
    GetConversationService,
    ListConversationMessagesService,
    MarkConversationReadService,
    ConversationAccessPolicyService,
    ConversationParticipantPolicy,
    UnreadCounterService,
    ConversationRepository,
    ConversationReadRepository,
    MessageRepository,
  ],
  exports: [
    DuoRevocationService,
    ConversationReaderService,
    ConversationArtifactService,
    ConversationCloserService,
    ConversationAccessPolicyService,
    ConversationRepository,
    ConversationReadRepository,
  ],
})
export class ConversationsModule {}
