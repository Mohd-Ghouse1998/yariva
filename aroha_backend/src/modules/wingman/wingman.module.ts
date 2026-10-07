import { ConversationsModule } from "../conversations/conversations.module";
import { AppLogger } from "../../common/logger/app-logger.service";
import { DatePlansModule } from "../date-plans/date-plans.module";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { DuoPlanService } from "./application/duo-plan.service";
import { DuoPlansController } from "./controllers/duo-plans.controller";
import { Module } from "@nestjs/common";
import { AuditLogService } from "../../common/services/audit-log.service";
import { ObjectStorageModule } from "../../integrations/object-storage/object-storage.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { NotificationsCoreModule } from "../notifications/notifications-core.module";
import { DuoDiscoveryService } from "./application/duo-discovery.service";
import { WingmanService } from "./application/wingman.service";
import { WingmanController } from "./controllers/wingman.controller";
import { DuoDiscoveryCache } from "./infrastructure/duo-discovery.cache";

@Module({
  imports: [ConversationsModule, DatePlansModule, FeatureFlagsModule, NotificationsCoreModule, ObjectStorageModule],
  controllers: [WingmanController, DuoPlansController],
  providers: [
    AppLogger,
    AuditLogService,
    DomainEventPublisher,
    DuoPlanService,
    WingmanService,
    DuoDiscoveryService,
    DuoDiscoveryCache,
  ],
  exports: [WingmanService],
})
export class WingmanModule {}
