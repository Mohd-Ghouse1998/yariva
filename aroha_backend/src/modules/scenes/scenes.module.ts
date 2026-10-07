import { Module } from "@nestjs/common";
import { ActivityModule } from "../activity/activity.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { ScenesService } from "./application/scenes.services";
import { ScenesController } from "./controllers/scenes.controller";
import {
  SceneDiscoveryCacheRepository,
  SceneRepository,
} from "./infrastructure/scenes.infrastructure";

@Module({
  imports: [FeatureFlagsModule, ActivityModule],
  controllers: [ScenesController],
  providers: [ScenesService, SceneRepository, SceneDiscoveryCacheRepository],
  exports: [ScenesService],
})
export class ScenesModule {}
