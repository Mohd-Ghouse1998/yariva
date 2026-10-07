import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";

@Injectable()
export class CurrentUserPolicy {
  assertSelf(actorUserId: string, resourceUserId: string): void {
    if (actorUserId !== resourceUserId) {
      throw new AppException(403, ERROR_CODES.FORBIDDEN, "Forbidden");
    }
  }
}

@Injectable()
export class AdminUserStatePolicy {
  assertPrivileged(actorRole: "USER" | "MODERATOR" | "ADMIN"): void {
    if (actorRole === "USER") {
      throw new AppException(
        403,
        ERROR_CODES.ADMIN_ROLE_REQUIRED,
        "Admin role required",
      );
    }
  }
}
