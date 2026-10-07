import { Module } from "@nestjs/common";
import { AuditLogService } from "../../common/services/audit-log.service";
import { ProfileCompletionService } from "../../common/services/profile-completion.service";
import { UsersModule } from "../users/users.module";
import {
  InterestCatalogService,
  ListInterestTagsService,
  UpdateUserInterestsService,
  UpdateUserIntentsService,
  UserIntentReaderService,
} from "./application/interests.services";
import { InterestCatalogController } from "./controllers/interest-catalog.controller";
import { MyInterestsController } from "./controllers/my-interests.controller";
import { MyIntentsController } from "./controllers/my-intents.controller";
import {
  IntentCompatibilityService,
  InterestOwnershipPolicy,
  InterestValidationService,
} from "./domain/interests.domain";
import {
  InterestProfileCompletionRepository,
  InterestTagRepository,
  UserInterestRepository,
  UserIntentRepository,
} from "./infrastructure/interests.infrastructure";

@Module({
  imports: [UsersModule],
  controllers: [
    InterestCatalogController,
    MyInterestsController,
    MyIntentsController,
  ],
  providers: [
    AuditLogService,
    ProfileCompletionService,
    InterestCatalogService,
    UserIntentReaderService,
    ListInterestTagsService,
    UpdateUserInterestsService,
    UpdateUserIntentsService,
    InterestValidationService,
    IntentCompatibilityService,
    InterestOwnershipPolicy,
    InterestTagRepository,
    UserInterestRepository,
    UserIntentRepository,
    InterestProfileCompletionRepository,
  ],
  exports: [InterestCatalogService, IntentCompatibilityService, UserIntentReaderService],
})
export class InterestsModule {}
