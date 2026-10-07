import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { VenueSearchQueryDto } from "../../date-plans/dto/date-plans.dto";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { DuoPlanService } from "../application/duo-plan.service";
import { CounterDuoPlanDto, CreateDuoPlanDto, RespondDuoPlanDto } from "../dto/duo-plan.dto";

@Controller("wingman")
export class DuoPlansController {
  constructor(private readonly plans: DuoPlanService) {}
  @Get("conversations/:conversationId/venues")
  venues(@CurrentUser() user: AuthContext["user"], @Param("conversationId", new ParseUUIDPipe()) conversationId: string, @Query() query: VenueSearchQueryDto) { return this.plans.venueSuggestions(user.id, conversationId, query); }
  @Get("conversations/:conversationId/plans")
  list(@CurrentUser() user: AuthContext["user"], @Param("conversationId", new ParseUUIDPipe()) conversationId: string) { return this.plans.list(user.id, conversationId); }
  @Post("conversations/:conversationId/plans")
  create(@CurrentUser() user: AuthContext["user"], @Param("conversationId", new ParseUUIDPipe()) conversationId: string, @Body() payload: CreateDuoPlanDto) { return this.plans.create(user.id, conversationId, payload); }
  @Post("plans/:planId/respond")
  respond(@CurrentUser() user: AuthContext["user"], @Param("planId", new ParseUUIDPipe()) planId: string, @Body() payload: RespondDuoPlanDto) { return this.plans.respond(user.id, planId, payload); }
  @Post("plans/:planId/counter")
  counter(@CurrentUser() user: AuthContext["user"], @Param("planId", new ParseUUIDPipe()) planId: string, @Body() payload: CounterDuoPlanDto) { return this.plans.counter(user.id, planId, payload); }
}
