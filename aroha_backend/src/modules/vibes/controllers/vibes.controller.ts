import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { VibesService } from "../application/vibes.service";
import { FinalizeVibeUploadDto, InitiateVibeUploadDto } from "../dto/vibes.dto";

@Controller("vibes")
export class VibesController {
  constructor(private readonly vibes: VibesService) {}

  @Get("me")
  mine(@CurrentUser() user: AuthContext["user"]) {
    return this.vibes.getMine(user.id);
  }

  @Get("users/:userId")
  forUser(
    @CurrentUser() user: AuthContext["user"],
    @Param("userId", new ParseUUIDPipe()) targetUserId: string,
  ) {
    return this.vibes.getForUser(user.id, targetUserId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("upload")
  initiate(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: InitiateVibeUploadDto,
  ) {
    return this.vibes.initiate(user.id, body);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(":vibeId/finalize")
  finalize(
    @CurrentUser() user: AuthContext["user"],
    @Param("vibeId", new ParseUUIDPipe()) vibeId: string,
    @Body() body: FinalizeVibeUploadDto,
  ) {
    return this.vibes.finalize(user.id, vibeId, body);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":vibeId")
  async remove(
    @CurrentUser() user: AuthContext["user"],
    @Param("vibeId", new ParseUUIDPipe()) vibeId: string,
  ): Promise<void> {
    await this.vibes.remove(user.id, vibeId);
  }
}
