import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { InvalidatePushTokenService, RegisterPushTokenService } from "../application/sessions.services";
import { PushTokenDto, type PushTokenResponseDto } from "../dto/sessions.dto";

@Controller("push-tokens")
export class PushTokensController {
  constructor(
    private readonly registerPushTokenService: RegisterPushTokenService,
    private readonly invalidatePushTokenService: InvalidatePushTokenService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async register(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Body() body: PushTokenDto,
    @Req() request: Request,
  ): Promise<PushTokenResponseDto> {
    return this.registerPushTokenService.execute({
      actor: {
        user,
        session,
        tokenJti: "",
      },
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":tokenId")
  async delete(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("tokenId", new ParseUUIDPipe()) tokenId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.invalidatePushTokenService.execute({
      actor: {
        user,
        session,
        tokenJti: "",
      },
      pushTokenId: tokenId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}
