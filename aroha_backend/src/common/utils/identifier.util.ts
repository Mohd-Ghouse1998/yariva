import { parsePhoneNumberFromString } from "libphonenumber-js";
import { ERROR_CODES } from "../constants/error-codes";
import { AppException } from "../errors/app.exception";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  const parsed = parsePhoneNumberFromString(phone);

  if (!parsed?.isValid()) {
    throw new AppException(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      "Invalid phone number",
    );
  }

  return parsed.number;
}

export function normalizeIdentifier(identifier: string): {
  type: "email" | "phone";
  value: string;
} {
  const candidate = identifier.trim();

  if (candidate.includes("@")) {
    return {
      type: "email",
      value: normalizeEmail(candidate),
    };
  }

  return {
    type: "phone",
    value: normalizePhone(candidate),
  };
}
