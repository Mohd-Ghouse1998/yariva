import { Module } from "@nestjs/common";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { AppLogger } from "../../common/logger/app-logger.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import {
  CreateNotificationService,
  ListNotificationsService,
  MarkNotificationReadService,
  NotificationDispatchService,
  PushDispatcherService,
} from "./application/notifications.services";
import {
  NotificationDedupService,
  NotificationOwnershipPolicy,
} from "./domain/notifications.domain";
import {
  NotificationRepository,
  PushDeliveryRepository,
  PushTokenReadRepository,
} from "./infrastructure/notifications.infrastructure";
import {
  ApnsPushTransport,
  FcmPushTransport,
} from "./infrastructure/push-transports";

@Module({
  imports: [FeatureFlagsModule],
  providers: [
    AppLogger,
    DomainEventPublisher,
    ListNotificationsService,
    MarkNotificationReadService,
    CreateNotificationService,
    NotificationDispatchService,
    PushDispatcherService,
    NotificationDedupService,
    NotificationOwnershipPolicy,
    NotificationRepository,
    PushTokenReadRepository,
    PushDeliveryRepository,
    FcmPushTransport,
    ApnsPushTransport,
  ],
  exports: [
    ListNotificationsService,
    MarkNotificationReadService,
    CreateNotificationService,
    NotificationDispatchService,
  ],
})
export class NotificationsCoreModule {}
