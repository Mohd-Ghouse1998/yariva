import { Module } from "@nestjs/common";
import { ProfileCompletionService } from "../../common/services/profile-completion.service";
import { GetMeService, UserReaderService } from "./application/users.services";
import { UsersController } from "./controllers/users.controller";
import { UserEligibilityService, UserStatePolicyService } from "./domain/users.domain";
import { UserRepository } from "./infrastructure/users.infrastructure";
import { AdminUserStatePolicy, CurrentUserPolicy } from "./policies/users.policies";

@Module({
  controllers: [UsersController],
  providers: [
    ProfileCompletionService,
    GetMeService,
    UserReaderService,
    UserStatePolicyService,
    UserEligibilityService,
    UserRepository,
    CurrentUserPolicy,
    AdminUserStatePolicy,
  ],
  exports: [UserReaderService, UserEligibilityService, UserRepository],
})
export class UsersModule {}
