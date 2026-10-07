import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../common/constants/error-codes";
import { AppException } from "../../common/errors/app.exception";
import type { AuthenticatedRequest } from "../../common/types/auth-context.type";
import { EvaluateFeatureFlagService } from "../feature-flags/application/feature-flags.services";

@Injectable()
export class PrivateStoriesFlagGuard implements CanActivate {
  constructor(private readonly flags: EvaluateFeatureFlagService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const enabled = await this.flags.execute({ key: "private_stories.v1", userId: request.auth.user.id });
    if (!enabled.enabled) throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Private Stories are unavailable");
    return true;
  }
}
