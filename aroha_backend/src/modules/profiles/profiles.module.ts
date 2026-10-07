import { Module } from "@nestjs/common";
import { AuditLogService } from "../../common/services/audit-log.service";
import { AppLogger } from "../../common/logger/app-logger.service";
import { ProfileCompletionService } from "../../common/services/profile-completion.service";
import { UsersModule } from "../users/users.module";
import { ProfilePhotosController } from "./controllers/profile-photos.controller";
import { ProfilesController } from "./controllers/profiles.controller";
import {
  DeleteProfilePhotoService,
  FinalizePhotoUploadService,
  GetOwnedPhotoService,
  InitiatePhotoUploadService,
  ReorderProfilePhotosService,
  SetPrimaryPhotoService,
} from "./application/profile-photos.services";
import {
  GetMyProfileService,
  GetPublicProfileService,
  ProfileCompletionSyncService,
  UpdateCommunicationPreferenceService,
  UpdateDiscoveryPreferenceService,
  UpdateLifestyleService,
  UpdateProfileService,
  UpdateSchedulePreferenceService,
} from "./application/profiles.services";
import {
  DiscoveryPreferencePolicyService,
  LocationPrivacyService,
  PhotoEligibilityService,
  PhotoOwnershipPolicy,
  ProfileOwnershipPolicy,
  ProfileVisibilityPolicyService,
} from "./domain/profiles.domain";
import {
  ProfileAggregateRepository,
  ProfilePhotoRepository,
  ProfilePhotoUploadStateStore,
  UserCommunicationPreferenceRepository,
  UserDiscoveryPreferenceRepository,
  UserLifestyleRepository,
  UserProfileRepository,
  UserSchedulePreferenceRepository,
} from "./infrastructure/profiles.infrastructure";

@Module({
  imports: [UsersModule],
  controllers: [ProfilesController, ProfilePhotosController],
  providers: [
    AppLogger,
    AuditLogService,
    ProfileCompletionService,
    GetMyProfileService,
    GetPublicProfileService,
    ProfileCompletionSyncService,
    UpdateProfileService,
    UpdateLifestyleService,
    UpdateSchedulePreferenceService,
    UpdateDiscoveryPreferenceService,
    UpdateCommunicationPreferenceService,
    InitiatePhotoUploadService,
    FinalizePhotoUploadService,
    GetOwnedPhotoService,
    ReorderProfilePhotosService,
    SetPrimaryPhotoService,
    DeleteProfilePhotoService,
    ProfileVisibilityPolicyService,
    PhotoEligibilityService,
    LocationPrivacyService,
    DiscoveryPreferencePolicyService,
    ProfileOwnershipPolicy,
    PhotoOwnershipPolicy,
    ProfileAggregateRepository,
    UserProfileRepository,
    ProfilePhotoRepository,
    UserLifestyleRepository,
    UserSchedulePreferenceRepository,
    UserDiscoveryPreferenceRepository,
    UserCommunicationPreferenceRepository,
    ProfilePhotoUploadStateStore,
  ],
  exports: [ProfileCompletionSyncService, ProfileVisibilityPolicyService],
})
export class ProfilesModule {}
