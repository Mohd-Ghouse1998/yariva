import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ERROR_CODES } from "../constants/error-codes";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AppException } from "../errors/app.exception";
import type { AuthenticatedRequest } from "../types/auth-context.type";
import { AuthContextService } from "../../modules/auth/application/auth.services";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authContextService: AuthContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Missing bearer token",
      });
    }

    const token = authorization.slice("Bearer ".length).trim();
    if (token.length === 0) {
      throw new AppException(401, ERROR_CODES.UNAUTHORIZED, "Missing bearer token");
    }

    request.auth = await this.authContextService.authenticateAccessToken(token);
    return true;
  }
}
