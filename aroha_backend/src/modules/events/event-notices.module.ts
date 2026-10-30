import { Module } from "@nestjs/common";
import { NotificationIntentModule } from "../notifications/notification-intent.module";
import { EventNoticesService } from "./event-notices.service";

@Module({ imports: [NotificationIntentModule], providers: [EventNoticesService], exports: [EventNoticesService] })
export class EventNoticesModule {}
