import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { normalizeEmail, normalizePhone } from "../../../common/utils/identifier.util";
import { PasswordHasherService } from "../infrastructure/auth.infrastructure";

@Injectable()
export class PasswordPolicyService {
  assertValidForSignup(input: {
    password: string;
    email?: string | null;
    phone?: string | null;
  }): void {
    const { password, email, phone } = input;

    if (
      password.length < 10 ||
      password.length > 72 ||
      password.trim().length === 0
    ) {
      throw new AppException(
        400,
        ERROR_CODES.AUTH_PASSWORD_WEAK,
        "Password does not meet policy requirements",
      );
    }

    const normalizedEmail = email ? normalizeEmail(email) : null;
    const normalizedPhone = phone ? normalizePhone(phone) : null;

    if (
      password === normalizedEmail ||
      password === normalizedPhone ||
      password === email ||
      password === phone
    ) {
      throw new AppException(
        400,
        ERROR_CODES.AUTH_PASSWORD_WEAK,
        "Password cannot match email or phone",
      );
    }
  }
}

@Injectable()
export class AuthEligibilityService {
  assertCanAuthenticate(input: {
    status: "ACTIVE" | "RESTRICTED" | "SUSPENDED" | "BANNED" | "DELETED";
    deletedAt: Date | null;
  }): void {
    if (input.deletedAt) {
      throw new AppException(
        403,
        ERROR_CODES.AUTH_ACCOUNT_RESTRICTED,
        "Account is not available",
      );
    }

    switch (input.status) {
      case "ACTIVE":
        return;
      case "RESTRICTED":
        throw new AppException(
          403,
          ERROR_CODES.AUTH_ACCOUNT_RESTRICTED,
          "Account is restricted",
        );
      case "SUSPENDED":
        throw new AppException(
          403,
          ERROR_CODES.AUTH_ACCOUNT_SUSPENDED,
          "Account is suspended",
        );
      case "BANNED":
      case "DELETED":
        throw new AppException(
          403,
          ERROR_CODES.AUTH_ACCOUNT_BANNED,
          "Account is banned",
        );
    }
  }
}

@Injectable()
export class CredentialVerificationService {
  constructor(private readonly passwordHasher: PasswordHasherService) {}

  async verifyOrThrow(password: string, passwordHash: string): Promise<void> {
    const valid = await this.passwordHasher.verify(password, passwordHash);

    if (!valid) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        "Invalid credentials",
      );
    }
  }
}
