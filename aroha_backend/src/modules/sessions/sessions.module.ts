import { Module } from "@nestjs/common";
import { AuditLogService } from "../../common/services/audit-log.service";
import {
  DeviceSessionPolicyService,
  SessionOwnershipPolicy,
  SessionRotationPolicyService,
} from "./domain/sessions.domain";
import {
  InvalidatePushTokenService,
  ListSessionsService,
  RegisterPushTokenService,
  RevokeAllOtherSessionsService,
  RevokeSessionService,
} from "./application/sessions.services";
import { PushTokensController } from "./controllers/push-tokens.controller";
import { SessionsController } from "./controllers/sessions.controller";
import {
  PushTokenRepository,
  UserSessionRepository,
} from "./infrastructure/sessions.infrastructure";

@Module({
  controllers: [SessionsController, PushTokensController],
  providers: [
    AuditLogService,
    ListSessionsService,
    RevokeSessionService,
    RevokeAllOtherSessionsService,
    RegisterPushTokenService,
    InvalidatePushTokenService,
    SessionRotationPolicyService,
    DeviceSessionPolicyService,
    SessionOwnershipPolicy,
    UserSessionRepository,
    PushTokenRepository,
  ],
  exports: [
    SessionRotationPolicyService,
    DeviceSessionPolicyService,
    UserSessionRepository,
  ],
})
export class SessionsModule {}
