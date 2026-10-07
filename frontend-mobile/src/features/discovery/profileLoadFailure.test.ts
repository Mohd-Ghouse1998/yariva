import { describe, expect, it } from "vitest";
import { ApiError } from "../../api/errors";
import { classifyProfileLoadFailure } from "./profileLoadFailure";

const apiError = (status: number, code: string, message: string) =>
  new ApiError(status, {
    statusCode: status,
    error: status === 404 ? "Not Found" : "Request failed",
    message,
    code,
    requestId: "request-1",
    timestamp: "2026-08-30T00:00:00.000Z",
  });

describe("classifyProfileLoadFailure", () => {
  it("distinguishes offline failures", () => {
    expect(classifyProfileLoadFailure(new TypeError("Network request failed"))).toBe("offline");
  });

  it("distinguishes missing and blocked profiles", () => {
    expect(
      classifyProfileLoadFailure(apiError(404, "PROFILE_NOT_FOUND", "Profile not found")),
    ).toBe("not-found");
    expect(
      classifyProfileLoadFailure(apiError(403, "FORBIDDEN", "Profile is not accessible")),
    ).toBe("blocked");
  });

  it("keeps server and unknown failures retryable", () => {
    expect(
      classifyProfileLoadFailure(apiError(503, "INTERNAL_ERROR", "Temporarily unavailable")),
    ).toBe("unavailable");
    expect(classifyProfileLoadFailure(new Error("unexpected"))).toBe("unavailable");
  });
});
