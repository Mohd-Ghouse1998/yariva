import { Module } from "@nestjs/common";
import { ActivityModule } from "../modules/activity/activity.module";
import { WeeklyRecapProcessor } from "./activity/weekly-recap.processor";
import { BlindModule } from "../modules/blind/blind.module";
import { BlindEventsProcessor } from "./blind/blind-events.processor";
import { ConfigModule } from "@nestjs/config";
import appConfig from "../config/app.config";
import authConfig from "../config/auth.config";
import bullmqConfig from "../config/bullmq.config";
import databaseConfig from "../config/database.config";
import objectStorageConfig from "../config/object-storage.config";
import redisConfig from "../config/redis.config";
import rtcConfig from "../config/rtc.config";
import scenesConfig from "../config/scenes.config";
import pushConfig from "../config/push.config";
import vibesConfig from "../config/vibes.config";
import { validationSchema } from "../config/validation.schema";
import { AppLogger } from "../common/logger/app-logger.service";
import { PrismaModule } from "../database/prisma/prisma.module";
import { BullmqModule } from "../integrations/bullmq/bullmq.module";
import { ObjectStorageModule } from "../integrations/object-storage/object-storage.module";
import { RedisModule } from "../integrations/redis/redis.module";
import { AuditLogService } from "../common/services/audit-log.service";
import { DomainEventPublisher } from "../common/services/domain-event.publisher";
import { AnalyticsModule } from "../modules/analytics/analytics.module";
import { CallsModule } from "../modules/calls/calls.module";
import { VibesModule } from "../modules/vibes/vibes.module";
import { ModerationModule } from "../modules/moderation/moderation.module";
import { NotificationsCoreModule } from "../modules/notifications/notifications-core.module";
import { AnalyticsRollupProcessor } from "./analytics/analytics-rollup.processor";
import { CallCleanupStaleProcessor } from "./calls/call-cleanup-stale.processor";
import { PassesCleanupExpiredProcessor } from "./likes/passes-cleanup-expired.processor";
import { PhotoModerationProcessor } from "./moderation/photo-moderation.processor";
import { MessageAttachmentModerationProcessor } from "./moderation/message-attachment-moderation.processor";
import { TrustScoreRecomputeProcessor } from "./moderation/trustscore-recompute.processor";
import { NotificationDispatchProcessor } from "./notification/notification-dispatch.processor";
import { DefaultQueueProcessor } from "./queue/default-queue.processor";
import { SessionsCleanupInactiveProcessor } from "./sessions/sessions-cleanup-inactive.processor";
import { DatePlanReminderProcessor } from "./date-plans/date-plan-reminder.processor";
import { VibeMediaProcessor } from "./vibes/vibe-media.processor";
import { PrivateStoryCleanupProcessor } from "./private-stories/private-story-cleanup.processor";

@Module({
  imports: [
    ActivityModule,
    BlindModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        redisConfig,
        bullmqConfig,
        objectStorageConfig,
        rtcConfig,
        scenesConfig,
        pushConfig,
        vibesConfig,
      ],
      validationSchema,
    }),
    PrismaModule,
    RedisModule,
    BullmqModule,
    ObjectStorageModule,
    NotificationsCoreModule,
    ModerationModule,
    AnalyticsModule,
    CallsModule,
    VibesModule,
  ],
  providers: [
    WeeklyRecapProcessor,
    BlindEventsProcessor,
    AppLogger,
    AuditLogService,
    DomainEventPublisher,
    NotificationDispatchProcessor,
    PhotoModerationProcessor,
    MessageAttachmentModerationProcessor,
    AnalyticsRollupProcessor,
    TrustScoreRecomputeProcessor,
    CallCleanupStaleProcessor,
    PassesCleanupExpiredProcessor,
    SessionsCleanupInactiveProcessor,
    DatePlanReminderProcessor,
    VibeMediaProcessor,
    PrivateStoryCleanupProcessor,
    DefaultQueueProcessor,
  ],
})
export class JobsModule {}
