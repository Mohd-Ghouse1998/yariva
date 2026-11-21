import { Module } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { AuditLogService } from "../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { ObjectStorageModule } from "../../integrations/object-storage/object-storage.module";
import { DiscoveryModule } from "../discovery/discovery.module";
import { MatchesModule } from "../matches/matches.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { UsersModule } from "../users/users.module";
import { ScenesModule } from "../scenes/scenes.module";
import { LikesController } from "./controllers/likes.controller";
import {
  CreateLikeService,
  CreatePassService,
  GetLikesReceivedService,
  LikeReaderService,
  RetractLikeService,
  RetractPassService,
} from "./application/likes.services";
import { LikePolicyService, PassPolicyService } from "./domain/likes.domain";
import {
  LikeIdempotencyRepository,
  LikeInteractionRepository,
  LikeRepository,
  PassRepository,
} from "./infrastructure/likes.infrastructure";

@Module({
  imports: [
    UsersModule,
    DiscoveryModule,
    MatchesModule,
    ConversationsModule,
    ObjectStorageModule,
    ScenesModule,
  ],
  controllers: [LikesController],
  providers: [
    AppLogger,
    AuditLogService,
    DomainEventPublisher,
    LikeReaderService,
    CreateLikeService,
    RetractLikeService,
    CreatePassService,
    RetractPassService,
    GetLikesReceivedService,
    LikePolicyService,
    PassPolicyService,
    LikeRepository,
    PassRepository,
    LikeInteractionRepository,
    LikeIdempotencyRepository,
  ],
  exports: [LikeReaderService],
})
export class LikesModule {}
