import { EventsModule } from "../events/events.module";
import { Module } from "@nestjs/common";
import { AuditLogService } from "../../common/services/audit-log.service";
import { AnalyticsModule } from "../analytics/analytics.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { ModerationModule } from "../moderation/moderation.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { VibesModule } from "../vibes/vibes.module";
import { AdminAnalyticsService } from "./application/admin.services";
import {
  AdminAuditLogService,
  AdminFeatureFlagsService,
  AdminModerationService,
  AdminUsersService,
} from "./application/admin.services";
import { AdminAnalyticsController } from "./controllers/admin-analytics.controller";
import { AdminAuditController } from "./controllers/admin-audit.controller";
import { AdminFeatureFlagsController } from "./controllers/admin-feature-flags.controller";
import { AdminModerationController } from "./controllers/admin-moderation.controller";
import { AdminUsersController } from "./controllers/admin-users.controller";
import { AdminVibeModerationController } from "./controllers/admin-vibe-moderation.controller";
import { AdminRoleGuard } from "./policies/admin-role.guard";
import { PrivateStoriesModule } from "../private-stories/private-stories.module";
import { AdminStoryModerationController } from "./controllers/admin-story-moderation.controller";

@Module({
  imports: [EventsModule,
    AnalyticsModule,
    FeatureFlagsModule,
    ModerationModule,
    NotificationsModule,
    VibesModule,
    PrivateStoriesModule,
  ],
  controllers: [
    AdminModerationController,
    AdminUsersController,
    AdminFeatureFlagsController,
    AdminAnalyticsController,
    AdminAuditController,
    AdminVibeModerationController,
    AdminStoryModerationController,
  ],
  providers: [
    AuditLogService,
    AdminRoleGuard,
    AdminModerationService,
    AdminUsersService,
    AdminFeatureFlagsService,
    AdminAnalyticsService,
    AdminAuditLogService,
  ],
})
export class AdminModule {}
