import { Module } from "@nestjs/common";
import { VibesService } from "./application/vibes.service";
import { VibesController } from "./controllers/vibes.controller";
import { AppLogger } from "../../common/logger/app-logger.service";
import { AuditLogService } from "../../common/services/audit-log.service";
import { VibeModerationService } from "./application/vibe-moderation.service";

@Module({
  controllers: [VibesController],
  providers: [AppLogger, AuditLogService, VibesService, VibeModerationService],
  exports: [VibesService, VibeModerationService],
})
export class VibesModule {}
