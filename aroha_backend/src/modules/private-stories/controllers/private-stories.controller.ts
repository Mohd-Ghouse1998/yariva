import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { PrivateStoriesService } from "../application/private-stories.service";
import { SavePrivateStoryDto, AudienceDto, CreatePrivateStoryDto, InitiatePrivateStoryMediaDto, PrivateCommunityDto, UpdatePrivateStoryDto } from "../dto/private-stories.dto";
import { PrivateStoriesFlagGuard } from "../private-stories-flag.guard";
import { EvaluateFeatureFlagService } from "../../feature-flags/application/feature-flags.services";

@Controller("private-stories")
export class PrivateStoriesCapabilitiesController {
  constructor(private readonly flags: EvaluateFeatureFlagService) {}
  @Header("Cache-Control", "private, no-store")
  @Get("capabilities")
  async capabilities(@CurrentUser() user: AuthContext["user"]) {
    const flag = await this.flags.execute({ key: "private_stories.v1", userId: user.id });
    return { enabled: flag.enabled };
  }
}

@Controller("private-stories")
@UseGuards(PrivateStoriesFlagGuard)
export class PrivateStoriesController {
  constructor(private readonly stories: PrivateStoriesService) {}
  @Header("Cache-Control", "private, no-store")
  @Get("connections") connections(@CurrentUser() user: AuthContext["user"]) { return this.stories.connections(user.id); }
  @Header("Cache-Control", "private, no-store")
  @Post("audience-preview") preview(@CurrentUser() user: AuthContext["user"], @Body() body: AudienceDto) { return this.stories.preview(user.id, body); }
  @Header("Cache-Control", "private, no-store")
  @Get("me") mine(@CurrentUser() user: AuthContext["user"], @Query("cursor") cursor?: string) { return this.stories.mine(user.id, cursor); }
  @Header("Cache-Control", "private, no-store")
  @Get("saved")
  saved(@CurrentUser() user: AuthContext["user"], @Query("cursor") cursor?: string) { return this.stories.mine(user.id, cursor, true); }
  @Patch(":storyId/saved") @Header("Cache-Control", "private, no-store")
  save(@CurrentUser() user: AuthContext["user"], @Param("storyId", new ParseUUIDPipe()) storyId: string, @Body() body: SavePrivateStoryDto) { return this.stories.setSaved(user.id, storyId, body.saved); }
  @Header("Cache-Control", "private, no-store")
  @Get("feed") feed(@CurrentUser() user: AuthContext["user"], @Query("cursor") cursor?: string) { return this.stories.feed(user.id, cursor); }
  @Header("Cache-Control", "private, no-store")
  @Get("community") community(@CurrentUser() user: AuthContext["user"]) { return this.stories.getCommunity(user.id); }
  @Patch("community") saveCommunity(@CurrentUser() user: AuthContext["user"], @Body() body: PrivateCommunityDto) { return this.stories.saveCommunity(user.id, body); }
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("media/upload") initiateMedia(@CurrentUser() user: AuthContext["user"], @Body() body: InitiatePrivateStoryMediaDto) { return this.stories.initiateMedia(user.id, body); }
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post() create(@CurrentUser() user: AuthContext["user"], @Body() body: CreatePrivateStoryDto) { return this.stories.create(user.id, body); }
  @Header("Cache-Control", "private, no-store")
  @Get(":storyId") detail(@CurrentUser() user: AuthContext["user"], @Param("storyId", new ParseUUIDPipe()) storyId: string) { return this.stories.detail(user.id, storyId); }
  @Patch(":storyId") update(@CurrentUser() user: AuthContext["user"], @Param("storyId", new ParseUUIDPipe()) storyId: string, @Body() body: UpdatePrivateStoryDto) { return this.stories.update(user.id, storyId, body); }
  @Delete(":storyId") remove(@CurrentUser() user: AuthContext["user"], @Param("storyId", new ParseUUIDPipe()) storyId: string) { return this.stories.remove(user.id, storyId); }
}

// Follows are an independent social graph. Story publication and viewing remain flag-gated.
@Controller("private-stories/follows")
export class PrivateFollowsController {
  constructor(private readonly stories: PrivateStoriesService) {}
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(":ownerId") requestFollow(@CurrentUser() user: AuthContext["user"], @Param("ownerId", new ParseUUIDPipe()) ownerId: string) { return this.stories.requestFollow(user.id, ownerId); }
  @Header("Cache-Control", "private, no-store")
  @Get("requests") requests(@CurrentUser() user: AuthContext["user"], @Query("cursor") cursor?: string) { return this.stories.followRequests(user.id, cursor); }
  @Header("Cache-Control", "private, no-store")
  @Get("summary") summary(@CurrentUser() user: AuthContext["user"]) { return this.stories.followSummary(user.id); }
  @Header("Cache-Control", "private, no-store")
  @Get("followers") followers(@CurrentUser() user: AuthContext["user"], @Query("cursor") cursor?: string) { return this.stories.followList(user.id, "followers", cursor); }
  @Header("Cache-Control", "private, no-store")
  @Get("following") following(@CurrentUser() user: AuthContext["user"], @Query("cursor") cursor?: string) { return this.stories.followList(user.id, "following", cursor); }
  @Header("Cache-Control", "private, no-store")
  @Get("status/:ownerId") status(@CurrentUser() user: AuthContext["user"], @Param("ownerId", new ParseUUIDPipe()) ownerId: string) { return this.stories.followStatus(user.id, ownerId); }
  @Post(":requesterId/approve") approve(@CurrentUser() user: AuthContext["user"], @Param("requesterId", new ParseUUIDPipe()) requesterId: string) { return this.stories.approveFollow(user.id, requesterId); }
  @Delete("followers/:requesterId") revoke(@CurrentUser() user: AuthContext["user"], @Param("requesterId", new ParseUUIDPipe()) requesterId: string) { return this.stories.revokeFollow(user.id, requesterId); }
  @Delete("requested/:ownerId") cancel(@CurrentUser() user: AuthContext["user"], @Param("ownerId", new ParseUUIDPipe()) ownerId: string) { return this.stories.cancelFollow(user.id, ownerId); }
}
