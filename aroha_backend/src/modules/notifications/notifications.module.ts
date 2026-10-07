import { Module } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { NotificationsController } from "./controllers/notifications.controller";
import { NotificationDomainEventSubscriberService } from "./infrastructure/notification-domain-event-subscriber.service";
import { NotificationsCoreModule } from "./notifications-core.module";

@Module({
  imports: [NotificationsCoreModule],
  controllers: [NotificationsController],
  providers: [
    AppLogger,
    NotificationDomainEventSubscriberService,
  ],
  exports: [NotificationsCoreModule],
})
export class NotificationsModule {}
