import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { Like, User, UserProfile } from "../../../generated/prisma/client";

type LikeTargetRecord = Pick<
  User,
  "id" | "status" | "deletedAt" | "isShadowBanned" | "isDiscoveryFrozen"
> & {
  profile: Pick<UserProfile, "isHidden" | "isComplete" | "deletedAt"> | null;
  photos: Array<{
    id: string;
  }>;
};

@Injectable()
export class LikePolicyService {
  assertCanLike(actorId: string, targetUserId: string): void {
    if (actorId === targetUserId) {
      throw new AppException(
        400,
        ERROR_CODES.LIKE_SELF_FORBIDDEN,
        "User cannot like themselves",
      );
    }
  }

  assertTargetEligible(target: LikeTargetRecord | null): asserts target is LikeTargetRecord {
    if (
      !target ||
      target.deletedAt !== null ||
      target.status !== "ACTIVE" ||
      target.isShadowBanned ||
      target.isDiscoveryFrozen ||
      !target.profile ||
      target.profile.deletedAt !== null ||
      target.profile.isHidden ||
      !target.profile.isComplete ||
      target.photos.length === 0
    ) {
      throw new AppException(
        409,
        ERROR_CODES.LIKE_TARGET_NOT_ELIGIBLE,
        "Target cannot currently be interacted with",
      );
    }
  }

  assertNotBlocked(isBlocked: boolean): void {
    if (isBlocked) {
      throw new AppException(
        409,
        ERROR_CODES.LIKE_BLOCKED,
        "Like blocked by active block",
      );
    }
  }

  assertCanRetract(like: Pick<Like, "status">): void {
    if (like.status === "RETRACTED") {
      throw new AppException(
        409,
        ERROR_CODES.LIKE_ALREADY_RETRACTED,
        "Like already retracted",
      );
    }
  }
}

@Injectable()
export class PassPolicyService {
  assertCanPass(actorId: string, targetUserId: string): void {
    if (actorId === targetUserId) {
      throw new AppException(
        400,
        ERROR_CODES.PASS_SELF_FORBIDDEN,
        "User cannot pass themselves",
      );
    }
  }
}
