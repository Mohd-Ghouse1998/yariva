import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CursorPageQueryDto } from "../../../common/dto/cursor-page-query.dto";
import type { AuthContext } from "../../../common/types/auth-context.type";
import type { RevokeOtherSessionsResponseDto, SessionPageDto } from "../dto/sessions.dto";
import {
  ListSessionsService,
  RevokeAllOtherSessionsService,
  RevokeSessionService,
} from "../application/sessions.services";

@Controller("sessions")
export class SessionsController {
  constructor(
    private readonly listSessionsService: ListSessionsService,
    private readonly revokeSessionService: RevokeSessionService,
    private readonly revokeAllOtherSessionsService: RevokeAllOtherSessionsService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Query() query: CursorPageQueryDto,
  ): Promise<SessionPageDto> {
    return this.listSessionsService.execute({
      userId: user.id,
      currentSessionId: session.id,
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 50) : 20,
    });
  }

  @Delete("others")
  async revokeOthers(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Req() request: Request,
  ): Promise<RevokeOtherSessionsResponseDto> {
    return this.revokeAllOtherSessionsService.execute({
      actor: {
        user,
        session,
        tokenJti: "",
      },
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":sessionId")
  async revoke(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("sessionId", new ParseUUIDPipe()) sessionId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.revokeSessionService.execute({
      actor: {
        user,
        session,
        tokenJti: "",
      },
      targetSessionId: sessionId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}
