import { Injectable } from "@nestjs/common";
import { AppException } from "../../../common/errors/app.exception";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import type { AuthContext } from "../../../common/types/auth-context.type";

@Injectable()
export class WsSessionPolicy {
  assertHandshakeSession(authContext: AuthContext, sessionId: string): void {
    if (authContext.session.id !== sessionId) {
      throw new AppException(
        401,
        ERROR_CODES.SESSION_INVALID,
        "Session is invalid",
      );
    }
  }
}
