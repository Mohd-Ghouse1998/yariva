import { Module } from "@nestjs/common";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { DiscoveryController } from "./controllers/discovery.controller";
import {
  DiscoveryQueryService,
  GetDiscoveryFeedService,
  InvalidateDiscoverySnapshotService,
} from "./application/discovery.services";
import {
  CandidateEligibilityService,
  DiscoveryAccessPolicy,
  DiscoveryDiversityService,
  DiscoveryPayloadMapperService,
  DiscoveryRankingService,
} from "./domain/discovery.domain";
import {
  DiscoveryQueryRepository,
  DiscoverySnapshotRepository,
} from "./infrastructure/discovery.infrastructure";

@Module({
  imports: [FeatureFlagsModule],
  controllers: [DiscoveryController],
  providers: [
    GetDiscoveryFeedService,
    InvalidateDiscoverySnapshotService,
    DiscoveryQueryService,
    DiscoveryAccessPolicy,
    CandidateEligibilityService,
    DiscoveryRankingService,
    DiscoveryDiversityService,
    DiscoveryPayloadMapperService,
    DiscoveryQueryRepository,
    DiscoverySnapshotRepository,
  ],
  exports: [InvalidateDiscoverySnapshotService, DiscoveryQueryService],
})
export class DiscoveryModule {}
