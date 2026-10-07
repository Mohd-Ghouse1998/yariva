import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { PhotoModerationService } from "../../modules/moderation/application/moderation.services";

@Injectable()
export class PhotoModerationProcessor {
  constructor(private readonly photoModerationService: PhotoModerationService) {}

  async process(job: Job): Promise<void> {
    const data =
      typeof job.data === "object" && job.data !== null
        ? (job.data as Record<string, unknown>)
        : {};
    if (typeof data.photoId !== "string") {
      return;
    }

    await this.photoModerationService.reviewPendingPhoto({
      photoId: data.photoId,
      approved: typeof data.approved === "boolean" ? data.approved : true,
      reason: typeof data.reason === "string" ? data.reason : null,
    });
  }
}

