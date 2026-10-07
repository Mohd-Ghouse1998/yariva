import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthContext } from "../types/auth-context.type";

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext["session"] => {
    const request = context.switchToHttp().getRequest();
    return request.auth.session;
  },
);
