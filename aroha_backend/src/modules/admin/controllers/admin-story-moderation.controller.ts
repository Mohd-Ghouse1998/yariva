import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { PrivateStoriesService } from "../../private-stories/application/private-stories.service";
import { AdminReviewPrivateStoryDto } from "../dto/admin.dto";
import { AdminRoleGuard } from "../policies/admin-role.guard";

@UseGuards(AdminRoleGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller("admin/moderation/private-stories")
export class AdminStoryModerationController {
  constructor(private readonly stories: PrivateStoriesService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  queue(@Query("cursor") cursor?: string) {
    return this.stories.moderationQueue(cursor);
  }

  @Get(":storyId")
  @Header("Cache-Control", "private, no-store")
  preview(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("storyId", new ParseUUIDPipe()) storyId: string,
    @Req() request: Request,
  ) {
    return this.stories.moderationPreview(storyId, {
      actorUserId: user.id, actorSessionId: session.id,
      ipAddress: request.ip ?? null, userAgent: request.get("user-agent") ?? null,
    });
  }

  @Post(":storyId/review")
  @Header("Cache-Control", "private, no-store")
  async review(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("storyId", new ParseUUIDPipe()) storyId: string,
    @Body() body: AdminReviewPrivateStoryDto,
    @Req() request: Request,
  ) {
    return { applied: await this.stories.review(storyId, body, {
      actorUserId: user.id, actorSessionId: session.id,
      ipAddress: request.ip ?? null, userAgent: request.get("user-agent") ?? null,
    }) };
  }
}
