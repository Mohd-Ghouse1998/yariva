import { Module } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { AuditLogService } from "../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { MatchesModule } from "../matches/matches.module";
import { UsersModule } from "../users/users.module";
import { RtcModule } from "../../integrations/rtc/rtc.module";
import { CallsController } from "./controllers/calls.controller";
import { CallCapabilitiesController } from "./controllers/call-capabilities.controller";
import {
  AcceptCallService,
  CallAccessService,
  CallCleanupSchedulerService,
  CallCleanupStaleService,
  CallSessionReaderService,
  DeclineCallService,
  EndCallService,
  InitiateCallService,
  RelaySignalService,
} from "./application/calls.services";
import {
  CallPermissionService,
  CallStateMachineService,
} from "./domain/calls.domain";
import {
  CallSessionRepository,
  MatchCallContextRepository,
  SignalingStateRepository,
} from "./infrastructure/calls.infrastructure";
import { CallParticipantPolicy } from "./policies/call-participant.policy";
import { CallsGateway } from "./calls.gateway";

@Module({
  imports: [MatchesModule, UsersModule, RtcModule],
  controllers: [CallCapabilitiesController, CallsController],
  providers: [
    AppLogger,
    AuditLogService,
    DomainEventPublisher,
    CallsGateway,
    CallSessionReaderService,
    CallCleanupSchedulerService,
    CallCleanupStaleService,
    InitiateCallService,
    AcceptCallService,
    CallAccessService,
    DeclineCallService,
    EndCallService,
    RelaySignalService,
    CallPermissionService,
    CallStateMachineService,
    CallParticipantPolicy,
    MatchCallContextRepository,
    CallSessionRepository,
    SignalingStateRepository,
  ],
  exports: [CallAccessService, CallPermissionService, CallSessionReaderService, CallCleanupStaleService],
})
export class CallsModule {}
