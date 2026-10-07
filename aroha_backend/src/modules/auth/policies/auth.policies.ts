import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { LoginDto, RefreshTokenDto, SignupDto } from "../dto/auth.dto";

@Injectable()
export class LocalCredentialPolicy {
  assertSignupPayload(input: SignupDto): void {
    if (!input.email && !input.phone) {
      throw new AppException(
        400,
        ERROR_CODES.AUTH_IDENTIFIER_REQUIRED,
        "Signup requires email or phone",
      );
    }
  }

  assertLoginPayload(input: LoginDto): void {
    if (!input.identifier || input.identifier.trim().length === 0) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        "Invalid credentials",
      );
    }
  }
}

@Injectable()
export class RefreshTokenPolicy {
  assertPayload(input: RefreshTokenDto): void {
    if (!input.refreshToken || input.refreshToken.trim().length === 0) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_REFRESH_INVALID,
        "Invalid refresh token",
      );
    }
  }
}
