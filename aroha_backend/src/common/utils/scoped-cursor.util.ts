import { isUUID } from "class-validator";
import { AppException } from "../errors/app.exception";
import { ERROR_CODES } from "../constants/error-codes";

export function encodeScopedCursor(row: { id: string; createdAt: Date }, scope: string): string {
  return Buffer.from(JSON.stringify({ id: row.id, createdAt: row.createdAt.toISOString(), scope })).toString("base64url");
}

export function decodeScopedCursor(value: string, scope: string): { id: string; createdAt: Date } {
  try {
    const data: unknown = JSON.parse(Buffer.from(value, "base64url").toString());
    if (!data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string" || !isUUID(data.id) ||
      !("scope" in data) || data.scope !== scope || !("createdAt" in data) || typeof data.createdAt !== "string" || !Number.isFinite(Date.parse(data.createdAt))) throw new Error();
    return { id: data.id, createdAt: new Date(data.createdAt) };
  } catch { throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor; refresh this search"); }
}
