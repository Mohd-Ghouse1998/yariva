import { Module } from "@nestjs/common";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { NotificationsCoreModule } from "../notifications/notifications-core.module";
import { MatchesModule } from "../matches/matches.module";
import { BlindService } from "./application/blind.service";
import { AdminBlindController, BlindController } from "./controllers/blind.controller";
@Module({ imports: [FeatureFlagsModule, NotificationsCoreModule, MatchesModule], providers: [BlindService], controllers: [BlindController, AdminBlindController], exports: [BlindService] })
export class BlindModule {}
