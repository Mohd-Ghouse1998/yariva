import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CursorPageQueryDto } from "../../../common/dto/cursor-page-query.dto";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  CreateLikeService,
  CreatePassService,
  GetLikesReceivedService,
  RetractLikeService,
  RetractPassService,
} from "../application/likes.services";
import {
  CreateLikeDto,
  CreatePassDto,
  type CreateLikeResponseDto,
  type PassDto,
  type ReceivedLikesResponseDto,
} from "../dto/likes.dto";

@Controller()
export class LikesController {
  constructor(
    private readonly createLikeService: CreateLikeService,
    private readonly retractLikeService: RetractLikeService,
    private readonly createPassService: CreatePassService,
    private readonly retractPassService: RetractPassService,
    private readonly getLikesReceivedService: GetLikesReceivedService,
  ) {}

  // Likes tab — incoming likes from other users.
  @Get("likes/received")
  async listReceivedLikes(
    @CurrentUser() user: AuthContext["user"],
    @Query() query: CursorPageQueryDto,
  ): Promise<ReceivedLikesResponseDto> {
    return this.getLikesReceivedService.execute({
      userId: user.id,
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 50) : 30,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post("likes")
  async createLike(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: CreateLikeDto,
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey?: string,
  ): Promise<CreateLikeResponseDto> {
    return this.createLikeService.execute({
      userId: user.id,
      payload: body,
      idempotencyKey,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Delete("likes/:targetUserId")
  @HttpCode(204)
  async retractLike(
    @CurrentUser() user: AuthContext["user"],
    @Param("targetUserId", new ParseUUIDPipe()) targetUserId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.retractLikeService.execute({
      userId: user.id,
      targetUserId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post("passes")
  async createPass(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: CreatePassDto,
    @Req() request: Request,
  ): Promise<PassDto> {
    return this.createPassService.execute({
      userId: user.id,
      targetUserId: body.targetUserId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Delete("passes/:targetUserId")
  @HttpCode(204)
  async retractPass(
    @CurrentUser() user: AuthContext["user"],
    @Param("targetUserId", new ParseUUIDPipe()) targetUserId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.retractPassService.execute({
      userId: user.id,
      targetUserId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}
