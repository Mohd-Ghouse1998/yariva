import { Module } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import {
  EvaluateFeatureFlagService,
  ListFeatureFlagsService,
  UpsertFeatureFlagService,
} from "./application/feature-flags.services";
import { FeatureFlagRuleService } from "./domain/feature-flags.domain";
import { FeatureFlagRepository } from "./infrastructure/feature-flags.infrastructure";

@Module({
  providers: [
    AppLogger,
    DomainEventPublisher,
    ListFeatureFlagsService,
    UpsertFeatureFlagService,
    EvaluateFeatureFlagService,
    FeatureFlagRuleService,
    FeatureFlagRepository,
  ],
  exports: [
    ListFeatureFlagsService,
    UpsertFeatureFlagService,
    EvaluateFeatureFlagService,
    FeatureFlagRepository,
  ],
})
export class FeatureFlagsModule {}

