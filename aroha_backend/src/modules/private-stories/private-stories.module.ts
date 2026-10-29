import { Module } from "@nestjs/common";
import { PrivateFollowsController, PrivateStoriesCapabilitiesController, PrivateStoriesController } from "./controllers/private-stories.controller";
import { PrivateStoriesService } from "./application/private-stories.service";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { PrivateStoriesFlagGuard } from "./private-stories-flag.guard";
import { AuditLogService } from "../../common/services/audit-log.service";
import { NotificationIntentModule } from "../notifications/notification-intent.module";
@Module({ imports: [FeatureFlagsModule, NotificationIntentModule], controllers: [PrivateStoriesCapabilitiesController, PrivateFollowsController, PrivateStoriesController], providers: [PrivateStoriesService, PrivateStoriesFlagGuard, AuditLogService], exports: [PrivateStoriesService] })
export class PrivateStoriesModule {}
