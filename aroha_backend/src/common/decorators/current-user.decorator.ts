import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthContext } from "../types/auth-context.type";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext["user"] => {
    const request = context.switchToHttp().getRequest();
    return request.auth.user;
  },
);
