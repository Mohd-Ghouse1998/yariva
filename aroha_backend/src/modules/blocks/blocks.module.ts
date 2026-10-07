import { Module } from "@nestjs/common";
import { ConversationsModule } from "../conversations/conversations.module";
import { AppLogger } from "../../common/logger/app-logger.service";
import { AuditLogService } from "../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { BlocksController } from "./controllers/blocks.controller";
import {
  CreateBlockService,
  ListBlocksService,
  RemoveBlockService,
} from "./application/blocks.services";
import { BlockPolicyService } from "./domain/blocks.domain";
import {
  BlockCascadeRepository,
  BlockRepository,
} from "./infrastructure/blocks.infrastructure";

@Module({
  imports: [ConversationsModule],
  controllers: [BlocksController],
  providers: [
    AppLogger,
    AuditLogService,
    DomainEventPublisher,
    CreateBlockService,
    RemoveBlockService,
    ListBlocksService,
    BlockPolicyService,
    BlockRepository,
    BlockCascadeRepository,
  ],
  exports: [CreateBlockService, RemoveBlockService, ListBlocksService, BlockRepository],
})
export class BlocksModule {}
