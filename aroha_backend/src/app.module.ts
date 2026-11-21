import { Module } from "@nestjs/common";
import { ActivityModule } from "./modules/activity/activity.module";
import { ConfigModule, ConfigType } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import appConfig from "./config/app.config";
import authConfig from "./config/auth.config";
import bullmqConfig from "./config/bullmq.config";
import databaseConfig from "./config/database.config";
import objectStorageConfig from "./config/object-storage.config";
import redisConfig from "./config/redis.config";
import rtcConfig from "./config/rtc.config";
import otpConfig from "./config/otp.config";
import scenesConfig from "./config/scenes.config";
import pushConfig from "./config/push.config";
import planningConfig from "./config/planning.config";
import vibesConfig from "./config/vibes.config";
import wingmanConfig from "./config/wingman.config";
import { validationSchema } from "./config/validation.schema";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { AppLogger } from "./common/logger/app-logger.service";
import { PrismaModule } from "./database/prisma/prisma.module";
import { BullmqModule } from "./integrations/bullmq/bullmq.module";
import { ObjectStorageModule } from "./integrations/object-storage/object-storage.module";
import { RedisModule } from "./integrations/redis/redis.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { DiscoveryModule } from "./modules/discovery/discovery.module";
import { LikesModule } from "./modules/likes/likes.module";
import { MatchesModule } from "./modules/matches/matches.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { PresenceModule } from "./modules/presence/presence.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { SessionsModule } from "./modules/sessions/sessions.module";
import { InterestsModule } from "./modules/interests/interests.module";
import { UsersModule } from "./modules/users/users.module";
import { CallsModule } from "./modules/calls/calls.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { BlocksModule } from "./modules/blocks/blocks.module";
import { ModerationModule } from "./modules/moderation/moderation.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { FeatureFlagsModule } from "./modules/feature-flags/feature-flags.module";
import { AdminModule } from "./modules/admin/admin.module";
import { DatePlansModule } from "./modules/date-plans/date-plans.module";
import { ScenesModule } from "./modules/scenes/scenes.module";
import { VibesModule } from "./modules/vibes/vibes.module";
import { WingmanModule } from "./modules/wingman/wingman.module";
import { BlindModule } from "./modules/blind/blind.module";
import { SocialModule } from "./modules/social/social.module";
import { PrivateStoriesModule } from "./modules/private-stories/private-stories.module";

@Module({
  imports: [
    ActivityModule,
    BlindModule,
    SocialModule,
    PrivateStoriesModule,
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
        otpConfig,
        scenesConfig,
        pushConfig,
        planningConfig,
        vibesConfig,
        wingmanConfig,
      ],
      validationSchema,
    }),
    ThrottlerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => [
        {
          ttl: config.defaultThrottleTtlMs,
          limit: config.defaultThrottleLimit,
        },
      ],
    }),
    PrismaModule,
    RedisModule,
    BullmqModule,
    ObjectStorageModule,
    UsersModule,
    SessionsModule,
    AuthModule,
    ProfilesModule,
    InterestsModule,
    DiscoveryModule,
    LikesModule,
    MatchesModule,
    DatePlansModule,
    ScenesModule,
    VibesModule,
    WingmanModule,
    ConversationsModule,
    MessagesModule,
    CallsModule,
    NotificationsModule,
    ModerationModule,
    ReportsModule,
    BlocksModule,
    AnalyticsModule,
    FeatureFlagsModule,
    AdminModule,
    PresenceModule,
  ],
  providers: [
    AppLogger,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
