import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { AppLogger } from "../../common/logger/app-logger.service";
import { RedisService } from "../../integrations/redis/redis.service";
import { AnalyticsSummaryService } from "../../modules/analytics/application/analytics.services";

@Injectable()
export class AnalyticsRollupProcessor {
  constructor(
    private readonly analyticsSummaryService: AnalyticsSummaryService,
    private readonly redis: RedisService,
    private readonly logger: AppLogger,
  ) {}

  async process(job: Job): Promise<void> {
    const windows = this.readWindows(job.data);
    for (const window of windows) {
      const summary = await this.analyticsSummaryService.execute(window);
      await this.redis.set(
        `analytics:rollup:${window}`,
        JSON.stringify({
          ...summary,
          computedAt: new Date().toISOString(),
        }),
        "EX",
        60 * 60,
      );
      this.logger.debug(`Analytics rollup refreshed for ${window}`);
    }
  }

  private readWindows(data: unknown): Array<"24h" | "7d" | "30d"> {
    if (
      typeof data === "object" &&
      data !== null &&
      Array.isArray((data as { windows?: unknown }).windows)
    ) {
      return (data as { windows: unknown[] }).windows.filter(
        (value): value is "24h" | "7d" | "30d" =>
          value === "24h" || value === "7d" || value === "30d",
      );
    }

    return ["24h", "7d", "30d"];
  }
}

