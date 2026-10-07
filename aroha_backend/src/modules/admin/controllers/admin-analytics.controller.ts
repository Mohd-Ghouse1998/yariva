import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AdminAnalyticsService } from "../application/admin.services";
import { AdminAnalyticsSummaryQueryDto } from "../dto/admin.dto";
import { AdminRoleGuard } from "../policies/admin-role.guard";

@UseGuards(AdminRoleGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller("admin/analytics")
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get("summary")
  async summary(@Query() query: AdminAnalyticsSummaryQueryDto) {
    return this.adminAnalyticsService.summary(query.window);
  }
}
