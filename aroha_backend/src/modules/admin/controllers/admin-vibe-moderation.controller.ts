import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { VibeModerationService } from "../../vibes/application/vibe-moderation.service";
import { AdminReviewVibeDto } from "../dto/admin.dto";
import { AdminRoleGuard } from "../policies/admin-role.guard";

@UseGuards(AdminRoleGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller("admin/moderation/vibes")
export class AdminVibeModerationController {
  constructor(private readonly vibeModerationService: VibeModerationService) {}

  @Post(":vibeId/review")
  async review(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("vibeId", new ParseUUIDPipe()) vibeId: string,
    @Body() body: AdminReviewVibeDto,
    @Req() request: Request,
  ) {
    const applied = await this.vibeModerationService.review({
      vibeId,
      decision: body.decision,
      provider: "admin-manual-review",
      reason: body.reason ?? null,
      actorUserId: user.id,
      actorSessionId: session.id,
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
    return { applied };
  }
}
