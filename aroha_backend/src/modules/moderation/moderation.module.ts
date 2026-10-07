import { Module } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { AuditLogService } from "../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { NotificationsCoreModule } from "../notifications/notifications-core.module";
import { ProfilesModule } from "../profiles/profiles.module";
import {
  ApplyAccountActionService,
  ApplyModerationActionService,
  AssignModerationCaseService,
  CreateModerationCaseService,
  ModerationUserReadService,
  PhotoModerationService,
  RecomputeTrustScoreService,
} from "./application/moderation.services";
import {
  ModerationCaseRepository,
  ModerationUserRepository,
  TrustScoreRepository,
} from "./infrastructure/moderation.infrastructure";

@Module({
  imports: [NotificationsCoreModule, ProfilesModule],
  providers: [
    AppLogger,
    AuditLogService,
    DomainEventPublisher,
    CreateModerationCaseService,
    AssignModerationCaseService,
    ApplyAccountActionService,
    ApplyModerationActionService,
    RecomputeTrustScoreService,
    PhotoModerationService,
    ModerationUserReadService,
    ModerationCaseRepository,
    ModerationUserRepository,
    TrustScoreRepository,
  ],
  exports: [
    CreateModerationCaseService,
    AssignModerationCaseService,
    ApplyAccountActionService,
    ApplyModerationActionService,
    RecomputeTrustScoreService,
    PhotoModerationService,
    ModerationCaseRepository,
    TrustScoreRepository,
  ],
})
export class ModerationModule {}
