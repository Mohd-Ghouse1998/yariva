import { Module } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { AuditLogService } from "../../common/services/audit-log.service";
import { AnalyticsModule } from "../analytics/analytics.module";
import { NotificationsCoreModule } from "../notifications/notifications-core.module";
import { DatePlansService } from "./application/date-plans.service";
import { DatePlansController } from "./controllers/date-plans.controller";
import { DatePlanPolicy } from "./domain/date-plans.policy";
import { DatePlansRepository } from "./infrastructure/date-plans.repository";

@Module({
  imports: [AnalyticsModule, NotificationsCoreModule],
  controllers: [DatePlansController],
  providers: [
    AppLogger,
    AuditLogService,
    DatePlansRepository,
    DatePlanPolicy,
    DatePlansService,
  ],
  exports: [DatePlansService],
})
export class DatePlansModule {}
