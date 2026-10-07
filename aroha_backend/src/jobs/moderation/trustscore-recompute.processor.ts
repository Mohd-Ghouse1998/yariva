import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { RecomputeTrustScoreService } from "../../modules/moderation/application/moderation.services";

@Injectable()
export class TrustScoreRecomputeProcessor {
  constructor(private readonly trustScoreService: RecomputeTrustScoreService) {}

  async process(job: Job): Promise<void> {
    const data =
      typeof job.data === "object" && job.data !== null
        ? (job.data as Record<string, unknown>)
        : {};
    if (typeof data.userId !== "string") {
      return;
    }

    await this.trustScoreService.execute(data.userId);
  }
}

