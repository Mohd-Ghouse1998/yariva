import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { User } from "../../../generated/prisma/client";

@Injectable()
export class UserStatePolicyService {
  assertReadable<TUser extends Pick<User, "deletedAt">>(
    user: TUser | null,
  ): asserts user is TUser {
    if (!user || user.deletedAt) {
      throw new AppException(
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "User not found",
      );
    }
  }
}

@Injectable()
export class UserEligibilityService {
  assertAccessible<TUser extends Pick<User, "deletedAt">>(
    user: TUser | null,
  ): asserts user is TUser {
    if (!user || user.deletedAt) {
      throw new AppException(
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "User not found",
      );
    }
  }
}
