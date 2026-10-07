import { describe, expect, it } from "vitest";
import { normalizeApiErrorBody } from "./errors";

describe("normalizeApiErrorBody", () => {
  it("unwraps the backend error envelope", () => {
    expect(
      normalizeApiErrorBody({
        error: {
          code: "SCENE_LOCATION_REQUIRED",
          message: "Update your location before using Scenes",
          requestId: "request-1",
          details: {},
        },
      }),
    ).toMatchObject({
      code: "SCENE_LOCATION_REQUIRED",
      message: "Update your location before using Scenes",
      requestId: "request-1",
    });
  });

  it("keeps compatibility with the legacy flat response and rejects invalid payloads", () => {
    expect(
      normalizeApiErrorBody({
        code: "UNAUTHORIZED",
        message: "Session rejected",
        requestId: "request-2",
      }),
    ).toMatchObject({ code: "UNAUTHORIZED" });
    expect(normalizeApiErrorBody({ error: "Bad Request" })).toBeNull();
  });
});
