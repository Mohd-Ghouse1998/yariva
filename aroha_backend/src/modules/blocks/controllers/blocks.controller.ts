import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CursorPageQueryDto } from "../../../common/dto/cursor-page-query.dto";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  CreateBlockService,
  ListBlocksService,
  RemoveBlockService,
} from "../application/blocks.services";
import type { BlockPageDto, BlockResponseDto } from "../dto/blocks.dto";
import { CreateBlockDto } from "../dto/blocks.dto";

@Controller("blocks")
export class BlocksController {
  constructor(
    private readonly createBlockService: CreateBlockService,
    private readonly removeBlockService: RemoveBlockService,
    private readonly listBlocksService: ListBlocksService,
  ) {}

  @Post()
  @HttpCode(200)
  async create(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Body() body: CreateBlockDto,
    @Req() request: Request,
  ): Promise<BlockResponseDto> {
    return this.createBlockService.execute({
      actor: { user, session, tokenJti: "" },
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Delete(":blockedUserId")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("blockedUserId", new ParseUUIDPipe()) blockedUserId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.removeBlockService.execute({
      actor: { user, session, tokenJti: "" },
      blockedUserId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Get()
  async list(
    @CurrentUser() user: AuthContext["user"],
    @Query() query: CursorPageQueryDto,
  ): Promise<BlockPageDto> {
    return this.listBlocksService.execute({
      blockerId: user.id,
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 50) : 20,
    });
  }
}

