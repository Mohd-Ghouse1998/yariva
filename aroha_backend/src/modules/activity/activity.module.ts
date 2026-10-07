import { Module } from "@nestjs/common";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { NotificationsCoreModule } from "../notifications/notifications-core.module";
import { ActivityService } from "./application/activity.service";
import { ActivityController } from "./controllers/activity.controller";
@Module({
  imports: [NotificationsCoreModule, FeatureFlagsModule],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
