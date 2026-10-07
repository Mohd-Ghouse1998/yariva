import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CursorPageQueryDto } from "../../../common/dto/cursor-page-query.dto";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { DatePlansService } from "../application/date-plans.service";
import {
  CounterDatePlanDto,
  CreateDatePlanDto,
  DatePlanCheckInDto,
  PostDateResponseDto,
  VenueSearchQueryDto,
} from "../dto/date-plans.dto";

@Controller()
export class DatePlansController {
  constructor(private readonly datePlans: DatePlansService) {}

  @Get("matches/:matchId/venue-suggestions")
  venueSuggestions(
    @CurrentUser() user: AuthContext["user"],
    @Param("matchId") matchId: string,
    @Query() query: VenueSearchQueryDto,
  ) {
    return this.datePlans.venueSuggestions(user.id, matchId, query);
  }

  @Post("matches/:matchId/date-plans")
  create(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("matchId") matchId: string,
    @Body() payload: CreateDatePlanDto,
  ) {
    return this.datePlans.create({ actor: { user, session, tokenJti: "" }, matchId, payload });
  }

  @Get("matches/:matchId/date-plans")
  listForMatch(
    @CurrentUser() user: AuthContext["user"],
    @Param("matchId") matchId: string,
    @Query() query: CursorPageQueryDto,
  ) {
    return this.datePlans.listForMatch({
      userId: user.id,
      matchId,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Get("date-plans")
  listForUser(
    @CurrentUser() user: AuthContext["user"],
    @Query() query: CursorPageQueryDto,
  ) {
    return this.datePlans.listForUser({ userId: user.id, cursor: query.cursor, limit: query.limit });
  }

  @Get("date-plans/:id")
  get(@CurrentUser() user: AuthContext["user"], @Param("id") id: string) {
    return this.datePlans.get(user.id, id);
  }

  @Post("date-plans/:id/accept")
  @HttpCode(200)
  accept(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("id") id: string,
  ) {
    return this.datePlans.accept({ actor: { user, session, tokenJti: "" }, datePlanId: id });
  }

  @Post("date-plans/:id/counter")
  @HttpCode(200)
  counter(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("id") id: string,
    @Body() payload: CounterDatePlanDto,
  ) {
    return this.datePlans.counter({ actor: { user, session, tokenJti: "" }, datePlanId: id, payload });
  }

  @Post("date-plans/:id/decline")
  @HttpCode(200)
  decline(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("id") id: string,
  ) {
    return this.datePlans.decline({ actor: { user, session, tokenJti: "" }, datePlanId: id });
  }

  @Post("date-plans/:id/cancel")
  @HttpCode(200)
  cancel(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("id") id: string,
  ) {
    return this.datePlans.cancel({ actor: { user, session, tokenJti: "" }, datePlanId: id });
  }

  @Post("date-plans/:id/complete")
  @HttpCode(200)
  complete(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("id") id: string,
  ) {
    return this.datePlans.complete({ actor: { user, session, tokenJti: "" }, datePlanId: id });
  }

  @Post("date-plans/:id/check-in")
  @HttpCode(200)
  checkIn(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("id") id: string,
    @Body() payload: DatePlanCheckInDto,
  ) {
    return this.datePlans.checkIn({ actor: { user, session, tokenJti: "" }, datePlanId: id, payload });
  }

  @Post("date-plans/:id/post-date-response")
  @HttpCode(200)
  postDateResponse(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("id") id: string,
    @Body() payload: PostDateResponseDto,
  ) {
    return this.datePlans.submitPostDateResponse({
      actor: { user, session, tokenJti: "" },
      datePlanId: id,
      payload,
    });
  }
}
