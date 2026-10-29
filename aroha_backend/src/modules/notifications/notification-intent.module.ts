import { Module } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { NotificationIntentService } from "./application/notification-intent.service";
import { NotificationRepository } from "./infrastructure/notifications.infrastructure";

// No dependency on Stories: both domain services can persist and dispatch
// authorized notices without introducing a circular module import.
@Module({
  providers: [AppLogger, DomainEventPublisher, NotificationRepository, NotificationIntentService],
  exports: [NotificationRepository, NotificationIntentService],
})
export class NotificationIntentModule {}
