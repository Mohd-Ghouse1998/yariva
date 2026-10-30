import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import type { AuthContext } from "../../common/types/auth-context.type";
import { AdminRoleGuard } from "../admin/policies/admin-role.guard";
import { AdminEventQueryDto, CurateEventDto, EventQueryDto } from "./events.dto";
import { EventsService } from "./events.service";

@Controller("events")
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class EventsController {
  constructor(private readonly events: EventsService) {}
  @Get("status") @Header("Cache-Control", "private, no-store")
  status(@CurrentUser() user: AuthContext["user"]) { return this.events.status(user.id); }
  @Get() @Header("Cache-Control", "private, no-store")
  list(@CurrentUser() user: AuthContext["user"], @Query() query: EventQueryDto) { return this.events.list(user.id, query); }
  @Get("places/:id") @Header("Cache-Control", "private, no-store")
  place(@CurrentUser() user: AuthContext["user"], @Param("id", new ParseUUIDPipe()) id: string) { return this.events.place(user.id, id); }
  @Get(":id") @Header("Cache-Control", "private, no-store")
  get(@CurrentUser() user: AuthContext["user"], @Param("id", new ParseUUIDPipe()) id: string) { return this.events.get(user.id, id); }
  @Post(":id/save")
  save(@CurrentUser() user: AuthContext["user"], @Param("id", new ParseUUIDPipe()) id: string) { return this.events.save(user.id, id); }
  @Delete(":id/save")
  unsave(@CurrentUser() user: AuthContext["user"], @Param("id", new ParseUUIDPipe()) id: string) { return this.events.unsave(user.id, id); }
}

@Controller("admin/events")
@UseGuards(AdminRoleGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class AdminEventsController {
  constructor(private readonly events: EventsService) {}
  @Get() @Header("Cache-Control", "private, no-store")
  list(@Query() query: AdminEventQueryDto) { return this.events.adminList(query); }
  @Get(":id") @Header("Cache-Control", "private, no-store")
  get(@Param("id", new ParseUUIDPipe()) id: string) { return this.events.adminGet(id); }
  @Put(":id")
  curate(@CurrentUser() user: AuthContext["user"], @CurrentSession() session: AuthContext["session"], @Param("id", new ParseUUIDPipe()) id: string, @Body() body: CurateEventDto) {
    return this.events.curate({ user, session, tokenJti: "" }, id, body);
  }
}
