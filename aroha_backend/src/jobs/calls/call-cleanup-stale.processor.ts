import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { CallCleanupStaleService } from "../../modules/calls/application/calls.services";

@Injectable()
export class CallCleanupStaleProcessor {
  constructor(private readonly callCleanupStaleService: CallCleanupStaleService) {}

  async process(job: Job): Promise<void> {
    const data =
      typeof job.data === "object" && job.data !== null
        ? (job.data as Record<string, unknown>)
        : {};

    await this.callCleanupStaleService.execute({
      callId: typeof data.callId === "string" ? data.callId : undefined,
    });
  }
}

