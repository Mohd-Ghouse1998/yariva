import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { IngestAnalyticsEventsService } from "../application/analytics.services";
import {
  IngestAnalyticsEventsDto,
  type IngestAnalyticsEventsResponseDto,
} from "../dto/analytics.dto";

@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly ingestAnalyticsEventsService: IngestAnalyticsEventsService,
  ) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post("events")
  @HttpCode(HttpStatus.ACCEPTED)
  async ingest(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Body() body: IngestAnalyticsEventsDto,
  ): Promise<IngestAnalyticsEventsResponseDto> {
    return this.ingestAnalyticsEventsService.execute({
      actor: { user, session, tokenJti: "" },
      payload: body,
    });
  }
}
