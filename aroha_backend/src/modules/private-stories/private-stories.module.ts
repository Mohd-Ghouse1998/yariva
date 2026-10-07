import { Module } from "@nestjs/common";
import { PrivateFollowsController, PrivateStoriesCapabilitiesController, PrivateStoriesController } from "./controllers/private-stories.controller";
import { PrivateStoriesService } from "./application/private-stories.service";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { PrivateStoriesFlagGuard } from "./private-stories-flag.guard";
@Module({ imports: [FeatureFlagsModule], controllers: [PrivateStoriesCapabilitiesController, PrivateFollowsController, PrivateStoriesController], providers: [PrivateStoriesService, PrivateStoriesFlagGuard], exports: [PrivateStoriesService] })
export class PrivateStoriesModule {}
