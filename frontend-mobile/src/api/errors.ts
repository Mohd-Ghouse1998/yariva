import type { ApiErrorBody, ApiErrorEnvelope } from "../types/api";

export function normalizeApiErrorBody(payload: unknown): ApiErrorBody | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const candidate =
    record.error && typeof record.error === "object"
      ? (record as unknown as ApiErrorEnvelope).error
      : (record as unknown as ApiErrorBody);
  if (
    !candidate ||
    typeof candidate.code !== "string" ||
    typeof candidate.message !== "string" ||
    typeof candidate.requestId !== "string"
  ) {
    return null;
  }
  return candidate;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: ApiErrorBody | null;
  readonly requestId: string | null;

  constructor(status: number, body: ApiErrorBody | null, message?: string) {
    super(message ?? body?.message ?? "Request failed");
    this.status = status;
    this.code = body?.code ?? "UNKNOWN_ERROR";
    this.body = body;
    this.requestId = body?.requestId ?? null;
  }

  isAuthInvalid(): boolean {
    return this.status === 401 || this.code === "UNAUTHORIZED" || this.code === "SESSION_INVALID";
  }

  isAccountRestricted(): boolean {
    return (
      this.code === "AUTH_ACCOUNT_RESTRICTED" ||
      this.code === "AUTH_ACCOUNT_SUSPENDED" ||
      this.code === "AUTH_ACCOUNT_BANNED"
    );
  }

  isProfileIncomplete(): boolean {
    return (
      this.code === "PROFILE_COMPLETION_REQUIRED" || this.code === "DISCOVERY_PROFILE_INCOMPLETE"
    );
  }

  isDuplicate(): boolean {
    return this.code === "REPORT_DUPLICATE" || this.code === "BLOCK_ALREADY_ACTIVE";
  }
}

export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && /network/i.test(err.message);
}
