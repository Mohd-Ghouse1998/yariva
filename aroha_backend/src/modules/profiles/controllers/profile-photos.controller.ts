import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  DeleteProfilePhotoService,
  FinalizePhotoUploadService,
  GetOwnedPhotoService,
  InitiatePhotoUploadService,
  ReorderProfilePhotosService,
  SetPrimaryPhotoService,
} from "../application/profile-photos.services";
import {
  FinalizeProfilePhotoUploadDto,
  InitiateProfilePhotoUploadDto,
  ReorderProfilePhotosDto,
  type FinalizeProfilePhotoUploadResponseDto,
  type InitiateProfilePhotoUploadResponseDto,
  type ProfilePhotoListResponseDto,
  type ProfilePhotoResponseDto,
} from "../dto/profiles.dto";

@Controller("profiles/photos")
export class ProfilePhotosController {
  constructor(
    private readonly initiatePhotoUploadService: InitiatePhotoUploadService,
    private readonly finalizePhotoUploadService: FinalizePhotoUploadService,
    private readonly getOwnedPhotoService: GetOwnedPhotoService,
    private readonly reorderProfilePhotosService: ReorderProfilePhotosService,
    private readonly setPrimaryPhotoService: SetPrimaryPhotoService,
    private readonly deleteProfilePhotoService: DeleteProfilePhotoService,
  ) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("upload")
  async initiateUpload(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: InitiateProfilePhotoUploadDto,
  ): Promise<InitiateProfilePhotoUploadResponseDto> {
    return this.initiatePhotoUploadService.execute({
      userId: user.id,
      payload: body,
    });
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("finalize")
  async finalizeUpload(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: FinalizeProfilePhotoUploadDto,
    @Req() request: Request,
  ): Promise<FinalizeProfilePhotoUploadResponseDto> {
    return this.finalizePhotoUploadService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Get(":photoId")
  async getPhoto(
    @CurrentUser() user: AuthContext["user"],
    @Param("photoId", new ParseUUIDPipe()) photoId: string,
  ): Promise<ProfilePhotoResponseDto> {
    return this.getOwnedPhotoService.execute({ userId: user.id, photoId });
  }

  @Patch("order")
  async reorder(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: ReorderProfilePhotosDto,
    @Req() request: Request,
  ): Promise<ProfilePhotoListResponseDto> {
    return this.reorderProfilePhotosService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Patch(":photoId/primary")
  async setPrimary(
    @CurrentUser() user: AuthContext["user"],
    @Param("photoId", new ParseUUIDPipe()) photoId: string,
    @Req() request: Request,
  ): Promise<ProfilePhotoResponseDto> {
    return this.setPrimaryPhotoService.execute({
      userId: user.id,
      photoId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":photoId")
  async delete(
    @CurrentUser() user: AuthContext["user"],
    @Param("photoId", new ParseUUIDPipe()) photoId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.deleteProfilePhotoService.execute({
      userId: user.id,
      photoId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}
