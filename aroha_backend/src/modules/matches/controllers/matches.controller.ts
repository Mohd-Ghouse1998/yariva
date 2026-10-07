import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CursorPageQueryDto } from "../../../common/dto/cursor-page-query.dto";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  EndMatchService,
  GetMatchService,
  ListMatchesService,
  UpdateMatchCommunicationSettingService,
} from "../application/matches.services";
import type {
  EndMatchResponseDto,
  MatchDetailResponseDto,
  MatchPageDto,
  UpdateMyMatchCommunicationSettingResponseDto,
} from "../dto/matches.dto";
import { UpdateMyMatchCommunicationSettingDto } from "../dto/matches.dto";

@Controller("matches")
export class MatchesController {
  constructor(
    private readonly listMatchesService: ListMatchesService,
    private readonly getMatchService: GetMatchService,
    private readonly endMatchService: EndMatchService,
    private readonly updateMatchCommunicationSettingService: UpdateMatchCommunicationSettingService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthContext["user"],
    @Query() query: CursorPageQueryDto,
  ): Promise<MatchPageDto> {
    return this.listMatchesService.execute({
      userId: user.id,
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 50) : 20,
    });
  }

  @Get(":matchId")
  async getById(
    @CurrentUser() user: AuthContext["user"],
    @Param("matchId", new ParseUUIDPipe()) matchId: string,
  ): Promise<MatchDetailResponseDto> {
    return this.getMatchService.execute({
      userId: user.id,
      matchId,
    });
  }

  @Delete(":matchId")
  async end(
    @CurrentUser() user: AuthContext["user"],
    @Param("matchId", new ParseUUIDPipe()) matchId: string,
    @Req() request: Request,
  ): Promise<EndMatchResponseDto> {
    return this.endMatchService.execute({
      userId: user.id,
      matchId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Put(":matchId/communication-settings/me")
  async updateMyCommunicationSetting(
    @CurrentUser() user: AuthContext["user"],
    @Param("matchId", new ParseUUIDPipe()) matchId: string,
    @Body() body: UpdateMyMatchCommunicationSettingDto,
    @Req() request: Request,
  ): Promise<UpdateMyMatchCommunicationSettingResponseDto> {
    return this.updateMatchCommunicationSettingService.execute({
      userId: user.id,
      matchId,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}
