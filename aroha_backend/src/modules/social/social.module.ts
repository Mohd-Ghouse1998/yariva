import {
  Body, Controller, Delete, Get, Header, Module, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../common/types/auth-context.type";
import { ConversationsModule } from "../conversations/conversations.module";
import { ConversationRepository } from "../conversations/infrastructure/conversations.infrastructure";
import { unavailable } from "./social-access";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { CirclesService } from "./circles.service";
import { ConnectionCheckInService } from "./connection-check-in.service";
import {
  CircleDecisionDto, CircleListDto, CloseCircleDto, CreateCircleActivityDto, CreateCircleDto,
  SetConnectionIntentDto, SetVibeTogetherDto, UpdateCircleActivityDto,
} from "./social.dto";

type User = AuthContext["user"];
const uuid = new ParseUUIDPipe();

@Controller("social")
@Throttle({ default: { limit: 60, ttl: 60000 } })
class SocialController {
  constructor(
    private readonly circles: CirclesService,
    private readonly checkIn: ConnectionCheckInService,
    private readonly conversations: ConversationRepository,
  ) {}

  @Get("status") @Header("Cache-Control", "private, no-store")
  status(@CurrentUser() user: User) { return this.checkIn.status(user.id); }

  @Get("venues") @Header("Cache-Control", "private, no-store")
  venues(@CurrentUser() user: User) { return this.circles.venues(user.id); }

  @Get("circles") @Header("Cache-Control", "private, no-store")
  list(@CurrentUser() user: User, @Query() query: CircleListDto) { return this.circles.list(user.id, query); }

  @Get("circles/:id") @Header("Cache-Control", "private, no-store")
  get(@CurrentUser() user: User, @Param("id", uuid) id: string) { return this.circles.get(user.id, id); }

  @Post("circles")
  create(@CurrentUser() user: User, @Body() body: CreateCircleDto) { return this.circles.create(user.id, body); }

  @Put("circles/:id/membership")
  request(@CurrentUser() user: User, @Param("id", uuid) id: string) { return this.circles.request(user.id, id); }

  @Delete("circles/:id/membership")
  leave(@CurrentUser() user: User, @Param("id", uuid) id: string) { return this.circles.leave(user.id, id); }

  @Put("circles/:id/members/:targetId")
  decide(@CurrentUser() user: User, @Param("id", uuid) id: string, @Param("targetId", uuid) targetId: string, @Body() body: CircleDecisionDto) {
    return this.circles.decide(user.id, id, targetId, body.approve);
  }

  @Delete("circles/:id/members/:targetId")
  remove(@CurrentUser() user: User, @Param("id", uuid) id: string, @Param("targetId", uuid) targetId: string) {
    return this.circles.leave(user.id, id, targetId);
  }

  @Put("circles/:id/close")
  close(@CurrentUser() user: User, @Param("id", uuid) id: string, @Body() body: CloseCircleDto) {
    return this.circles.close(user.id, id, body.cancel);
  }

  @Put("circles/:id/recovery") @Header("Cache-Control", "private, no-store")
  recover(@CurrentUser() user: User, @Param("id", uuid) id: string) {
    return this.circles.recover(user.id, id);
  }

  @Post("circles/:id/activities")
  createActivity(@CurrentUser() user: User, @Param("id", uuid) id: string, @Body() body: CreateCircleActivityDto) {
    return this.circles.createActivity(user.id, id, body);
  }

  @Put("circles/:id/activities/:activityId")
  updateActivity(
    @CurrentUser() user: User, @Param("id", uuid) id: string, @Param("activityId", uuid) activityId: string,
    @Body() body: UpdateCircleActivityDto,
  ) {
    return this.circles.updateActivity(user.id, id, activityId, body);
  }

  @Delete("circles/:id/activities/:activityId")
  cancelActivity(@CurrentUser() user: User, @Param("id", uuid) id: string, @Param("activityId", uuid) activityId: string) {
    return this.circles.updateActivity(user.id, id, activityId, null);
  }

  @Put("circles/:id/activities/:activityId/responses/:need")
  respond(
    @CurrentUser() user: User, @Param("id", uuid) id: string, @Param("activityId", uuid) activityId: string,
    @Param("need", ParseIntPipe) need: number,
  ) {
    return this.circles.respond(user.id, id, activityId, need, false);
  }

  @Delete("circles/:id/activities/:activityId/responses/:need")
  withdraw(
    @CurrentUser() user: User, @Param("id", uuid) id: string, @Param("activityId", uuid) activityId: string,
    @Param("need", ParseIntPipe) need: number,
  ) {
    return this.circles.respond(user.id, id, activityId, need, true);
  }

  @Put("circles/:id/activities/:activityId/responses/:need/:targetId")
  decideActivity(
    @CurrentUser() user: User, @Param("id", uuid) id: string, @Param("activityId", uuid) activityId: string,
    @Param("need", ParseIntPipe) need: number, @Param("targetId", uuid) targetId: string, @Body() body: CircleDecisionDto,
  ) {
    return this.circles.decideActivity(user.id, id, activityId, targetId, need, body.approve);
  }

  @Get("conversations/:id/current-circle-chat") @Header("Cache-Control", "private, no-store")
  async currentCircleChat(@CurrentUser() user: User, @Param("id", uuid) id: string) {
    const conversationId = await this.conversations.findCurrentCircleChatForMember(id, user.id);
    if (!conversationId) unavailable();
    return { conversationId };
  }

  @Get("conversations/:id/check-in") @Header("Cache-Control", "private, no-store")
  getCheckIn(@CurrentUser() user: User, @Param("id", uuid) id: string) { return this.checkIn.get(user.id, id); }

  @Put("conversations/:id/check-in/intent") @Header("Cache-Control", "private, no-store")
  setIntent(@CurrentUser() user: User, @Param("id", uuid) id: string, @Body() body: SetConnectionIntentDto) {
    return this.checkIn.intent(user.id, id, body);
  }

  @Put("conversations/:id/check-in/vibe") @Header("Cache-Control", "private, no-store")
  setVibe(@CurrentUser() user: User, @Param("id", uuid) id: string, @Body() body: SetVibeTogetherDto) {
    return this.checkIn.vibe(user.id, id, body);
  }
}

@Module({
  imports: [FeatureFlagsModule, ConversationsModule],
  controllers: [SocialController],
  providers: [CirclesService, ConnectionCheckInService],
})
export class SocialModule {}
