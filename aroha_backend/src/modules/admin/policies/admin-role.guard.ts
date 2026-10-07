import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { AuthenticatedRequest } from "../../../common/types/auth-context.type";

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.auth?.user.role !== "ADMIN") {
      throw new AppException(
        403,
        ERROR_CODES.ADMIN_ROLE_REQUIRED,
        "Admin role is required",
      );
    }

    return true;
  }
}

