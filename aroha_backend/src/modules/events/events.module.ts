import { EventsReportingService } from "./events-reporting.service";
import { EventNoticesModule } from "./event-notices.module";
import { ReviewedVenuesModule } from "../date-plans/reviewed-venues.module";
import { Module } from "@nestjs/common";
import { AuditLogService } from "../../common/services/audit-log.service";
import { AdminRoleGuard } from "../admin/policies/admin-role.guard";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { AdminEventsController, EventsController } from "./events.controller";
import { EventsService } from "./events.service";

@Module({ imports: [FeatureFlagsModule, ReviewedVenuesModule, EventNoticesModule], controllers: [EventsController, AdminEventsController], providers: [EventsReportingService, EventsService, AuditLogService, AdminRoleGuard], exports: [EventsService, EventsReportingService] })
export class EventsModule {}
