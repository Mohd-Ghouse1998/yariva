import { WORK_CATEGORIES } from "../domain/work-categories";
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  GetMyProfileService,
  GetPublicProfileService,
  UpdateCommunicationPreferenceService,
  UpdateDiscoveryPreferenceService,
  UpdateLifestyleService,
  UpdateProfileService,
  UpdateSchedulePreferenceService,
} from "../application/profiles.services";
import type { PublicProfileDto } from "../../discovery/dto/discovery.dto";
import type {
  CommunicationPreferenceDto,
  DiscoveryPreferenceDto,
  LifestyleDto,
  MyProfileResponseDto,
  PreferenceValueResponseDto,
  SchedulePreferenceDto,
} from "../dto/profiles.dto";
import {
  UpdateCommunicationPreferenceDto,
  UpdateDiscoveryPreferenceDto,
  UpdateLifestyleDto,
  UpdateMyProfileDto,
  UpdateSchedulePreferenceDto,
} from "../dto/profiles.dto";

@Controller("profiles")
export class ProfilesController {
  constructor(
    private readonly getMyProfileService: GetMyProfileService,
    private readonly getPublicProfileService: GetPublicProfileService,
    private readonly updateProfileService: UpdateProfileService,
    private readonly updateLifestyleService: UpdateLifestyleService,
    private readonly updateSchedulePreferenceService: UpdateSchedulePreferenceService,
    private readonly updateDiscoveryPreferenceService: UpdateDiscoveryPreferenceService,
    private readonly updateCommunicationPreferenceService: UpdateCommunicationPreferenceService,
  ) {}

  @Get("me")
  async getMe(
    @CurrentUser() user: AuthContext["user"],
  ): Promise<MyProfileResponseDto> {
    return this.getMyProfileService.execute(user.id);
  }

  @Get("work-categories")
  getWorkCategories() {
    return { items: WORK_CATEGORIES };
  }

  @Get(":userId")
  async getPublicProfile(
    @CurrentUser() user: AuthContext["user"],
    @Param("userId", new ParseUUIDPipe()) targetUserId: string,
  ): Promise<{ profile: PublicProfileDto }> {
    return this.getPublicProfileService.execute({
      viewerId: user.id,
      targetUserId,
    });
  }

  @Patch("me")
  async updateMe(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: UpdateMyProfileDto,
    @Req() request: Request,
  ): Promise<MyProfileResponseDto> {
    return this.updateProfileService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Put("me/lifestyle")
  async updateLifestyle(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: UpdateLifestyleDto,
    @Req() request: Request,
  ): Promise<PreferenceValueResponseDto<LifestyleDto>> {
    return this.updateLifestyleService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Put("me/schedule-preference")
  async updateSchedulePreference(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: UpdateSchedulePreferenceDto,
    @Req() request: Request,
  ): Promise<PreferenceValueResponseDto<SchedulePreferenceDto>> {
    return this.updateSchedulePreferenceService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Put("me/discovery-preference")
  async updateDiscoveryPreference(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: UpdateDiscoveryPreferenceDto,
    @Req() request: Request,
  ): Promise<PreferenceValueResponseDto<DiscoveryPreferenceDto>> {
    return this.updateDiscoveryPreferenceService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Put("me/communication-preference")
  async updateCommunicationPreference(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: UpdateCommunicationPreferenceDto,
    @Req() request: Request,
  ): Promise<PreferenceValueResponseDto<CommunicationPreferenceDto>> {
    return this.updateCommunicationPreferenceService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}
