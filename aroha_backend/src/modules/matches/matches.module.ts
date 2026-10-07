import { Module } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { AuditLogService } from "../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { DiscoveryModule } from "../discovery/discovery.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { MatchesController } from "./controllers/matches.controller";
import {
  CreateMatchArtifactsService,
  EndMatchService,
  GetMatchService,
  ListMatchesService,
  MatchReaderService,
  UpdateMatchCommunicationSettingService,
} from "./application/matches.services";
import {
  MatchCommunicationPolicyService,
  MatchParticipantPolicy,
  MatchPolicyService,
} from "./domain/matches.domain";
import {
  MatchCommunicationSettingRepository,
  MatchRepository,
} from "./infrastructure/matches.infrastructure";

@Module({
  imports: [DiscoveryModule, ConversationsModule],
  controllers: [MatchesController],
  providers: [
    AppLogger,
    AuditLogService,
    DomainEventPublisher,
    MatchReaderService,
    CreateMatchArtifactsService,
    ListMatchesService,
    GetMatchService,
    EndMatchService,
    UpdateMatchCommunicationSettingService,
    MatchPolicyService,
    MatchCommunicationPolicyService,
    MatchParticipantPolicy,
    MatchRepository,
    MatchCommunicationSettingRepository,
  ],
  exports: [
    MatchReaderService,
    CreateMatchArtifactsService,
    MatchPolicyService,
    MatchCommunicationPolicyService,
  ],
})
export class MatchesModule {}
