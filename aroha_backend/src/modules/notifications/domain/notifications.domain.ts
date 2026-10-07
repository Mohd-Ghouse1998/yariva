import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { Notification } from "../../../generated/prisma/client";

@Injectable()
export class NotificationOwnershipPolicy {
  assertOwned(userId: string, notification: Pick<Notification, "userId">): void {
    if (notification.userId !== userId) {
      throw new AppException(
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "Notification not found",
      );
    }
  }
}

@Injectable()
export class NotificationDedupService {
  buildDedupeKey(parts: Array<string | null | undefined>): string {
    return parts
      .map((part) => (part && part.trim().length > 0 ? part.trim() : "none"))
      .join(":")
      .slice(0, 255);
  }
}

