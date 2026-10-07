import { classifyApnsFailure, classifyFcmFailure } from "./push-transports";

describe("native push response classification", () => {
  it("invalidates provider-rejected tokens without retrying", () => {
    expect(
      classifyFcmFailure(404, {
        error: { details: [{ errorCode: "UNREGISTERED" }] },
      }),
    ).toEqual({ code: "UNREGISTERED", invalidToken: true, retryable: false });
    expect(classifyApnsFailure(410, "Unregistered")).toEqual({
      invalidToken: true,
      retryable: false,
    });
  });

  it("retries throttling and server failures but not credential/payload failures", () => {
    expect(classifyFcmFailure(429, { error: { status: "RESOURCE_EXHAUSTED" } })).toEqual({
      code: "RESOURCE_EXHAUSTED",
      invalidToken: false,
      retryable: true,
    });
    expect(classifyApnsFailure(503, "ServiceUnavailable").retryable).toBe(true);
    expect(classifyFcmFailure(401, { error: { status: "UNAUTHENTICATED" } }).retryable).toBe(
      false,
    );
    expect(classifyApnsFailure(400, "BadPayload").retryable).toBe(false);
  });
});
