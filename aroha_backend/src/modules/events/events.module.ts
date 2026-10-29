import { Module } from "@nestjs/common";
import { AuditLogService } from "../../common/services/audit-log.service";
import { AdminRoleGuard } from "../admin/policies/admin-role.guard";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { AdminEventsController, EventsController } from "./events.controller";
import { EventsService } from "./events.service";

@Module({ imports: [FeatureFlagsModule], controllers: [EventsController, AdminEventsController], providers: [EventsService, AuditLogService, AdminRoleGuard], exports: [EventsService] })
export class EventsModule {}
