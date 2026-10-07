import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { AdminRoleGuard } from "../../admin/policies/admin-role.guard";
import { BlindService } from "../application/blind.service";
import { JoinBlindEventDto, ScheduleBlindEventDto } from "../dto/blind.dto";

@Controller("blind")
export class BlindController {
  constructor(private readonly blind: BlindService) {}
  @Get("capabilities") capabilities(@CurrentUser() user: AuthContext["user"]) { return this.blind.capabilities(user.id); }
  @Get("events/current") current(@CurrentUser() user: AuthContext["user"]) { return this.blind.current(user.id); }
  @Get("events/:id") event(@CurrentUser() user: AuthContext["user"], @Param("id", new ParseUUIDPipe()) id: string) { return this.blind.event(user.id, id); }
  @Post("events/:id/join") join(@CurrentUser() user: AuthContext["user"], @Param("id", new ParseUUIDPipe()) id: string, @Body() body: JoinBlindEventDto) { return this.blind.join(user.id, id, body); }
  @Post("events/:id/leave") leave(@CurrentUser() user: AuthContext["user"], @Param("id", new ParseUUIDPipe()) id: string) { return this.blind.leave(user.id, id); }
  @Get("events/:id/people") people(@CurrentUser() user: AuthContext["user"], @Param("id", new ParseUUIDPipe()) id: string) { return this.blind.candidates(user.id, id); }
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("events/:id/interest/:targetId") interest(@CurrentUser() user: AuthContext["user"], @Param("id", new ParseUUIDPipe()) id: string, @Param("targetId", new ParseUUIDPipe()) targetId: string) { return this.blind.interest(user.id, id, targetId); }
  @Get("relationships/:matchId") relationship(@CurrentUser() user: AuthContext["user"], @Param("matchId", new ParseUUIDPipe()) id: string) { return this.blind.relationship(user.id, id); }
  @Post("relationships/:matchId/reveal") reveal(@CurrentUser() user: AuthContext["user"], @Param("matchId", new ParseUUIDPipe()) id: string) { return this.blind.requestReveal(user.id, id); }
}

@UseGuards(AdminRoleGuard)
@Controller("admin/blind/events")
export class AdminBlindController {
  constructor(private readonly blind: BlindService) {}
  @Post() schedule(@Body() body: ScheduleBlindEventDto) { return this.blind.schedule(body); }
  @Post(":id/cancel") cancel(@Param("id", new ParseUUIDPipe()) id: string) { return this.blind.cancel(id); }
}
