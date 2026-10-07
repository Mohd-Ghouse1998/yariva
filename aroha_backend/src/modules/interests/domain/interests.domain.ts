import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { InterestTag } from "../../../generated/prisma/client";
import type { ConnectionIntentValue } from "../dto/interests.dto";

@Injectable()
export class InterestValidationService {
  normalizeInterestIds(interestTagIds: string[]): string[] {
    return Array.from(new Set(interestTagIds));
  }

  assertAllActiveTagsExist(
    requestedTagIds: string[],
    tags: InterestTag[],
  ): void {
    if (requestedTagIds.length === 0) {
      return;
    }

    const activeTagIds = new Set(tags.filter((tag) => tag.isActive).map((tag) => tag.id));
    const missing = requestedTagIds.filter((tagId) => !activeTagIds.has(tagId));

    if (missing.length > 0) {
      throw new AppException(
        404,
        ERROR_CODES.INTEREST_TAG_NOT_FOUND,
        "One or more interest tags were not found",
        {
          missingInterestTagIds: missing,
        },
      );
    }
  }
}

@Injectable()
export class IntentCompatibilityService {
  normalizeIntents(intents: ConnectionIntentValue[]): ConnectionIntentValue[] {
    const normalized = Array.from(new Set(intents));

    if (normalized.length === 0) {
      throw new AppException(
        400,
        ERROR_CODES.INTENT_REQUIRED,
        "At least one intent is required",
      );
    }

    return normalized;
  }
}

@Injectable()
export class InterestOwnershipPolicy {
  assertSelf(actorUserId: string, targetUserId: string): void {
    if (actorUserId !== targetUserId) {
      throw new AppException(403, ERROR_CODES.FORBIDDEN, "Forbidden");
    }
  }
}
