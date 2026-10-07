import { Module } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { AuditLogService } from "../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { ModerationModule } from "../moderation/moderation.module";
import { PrivateStoriesModule } from "../private-stories/private-stories.module";
import { ReportsController } from "./controllers/reports.controller";
import {
  CreateReportService,
  ListMyReportsService,
} from "./application/reports.services";
import {
  ReportDeduplicationService,
  ReportPolicyService,
} from "./domain/reports.domain";
import {
  ReportRepository,
  ReportTargetRepository,
} from "./infrastructure/reports.infrastructure";

@Module({
  imports: [ModerationModule, PrivateStoriesModule],
  controllers: [ReportsController],
  providers: [
    AppLogger,
    AuditLogService,
    DomainEventPublisher,
    CreateReportService,
    ListMyReportsService,
    ReportPolicyService,
    ReportDeduplicationService,
    ReportRepository,
    ReportTargetRepository,
  ],
  exports: [CreateReportService, ListMyReportsService, ReportRepository],
})
export class ReportsModule {}
