import { Buffer } from "node:buffer";
import { ERROR_CODES } from "../constants/error-codes";
import { AppException } from "../errors/app.exception";

export interface DateIdCursor {
  createdAt: string;
  id: string;
}

export function encodeDateIdCursor(cursor: DateIdCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeDateIdCursor(cursor: string): DateIdCursor {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<DateIdCursor>;

    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.createdAt.length === 0 ||
      parsed.id.length === 0
    ) {
      throw new Error("Malformed cursor");
    }

    return {
      createdAt: parsed.createdAt,
      id: parsed.id,
    };
  } catch {
    throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
  }
}
