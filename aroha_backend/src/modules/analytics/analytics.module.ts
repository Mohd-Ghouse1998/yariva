import { Module } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { AnalyticsController } from "./controllers/analytics.controller";
import {
  AnalyticsEventWriterService,
  AnalyticsSummaryService,
  IngestAnalyticsEventsService,
} from "./application/analytics.services";
import {
  AnalyticsEventRepository,
  AnalyticsSummaryRepository,
} from "./infrastructure/analytics.infrastructure";

@Module({
  controllers: [AnalyticsController],
  providers: [
    AppLogger,
    DomainEventPublisher,
    IngestAnalyticsEventsService,
    AnalyticsEventWriterService,
    AnalyticsSummaryService,
    AnalyticsEventRepository,
    AnalyticsSummaryRepository,
  ],
  exports: [
    AnalyticsEventWriterService,
    AnalyticsSummaryService,
    AnalyticsEventRepository,
    AnalyticsSummaryRepository,
  ],
})
export class AnalyticsModule {}
