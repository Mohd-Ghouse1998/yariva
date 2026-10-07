import { describe, expect, it } from "vitest";
import { signupPasswordError } from "./authValidation";

describe("signup password validation", () => {
  it("matches the backend 10 to 72 character policy", () => {
    expect(signupPasswordError("short1234")).toBe("Use at least 10 characters.");
    expect(signupPasswordError("abcdefghij")).toBeNull();
    expect(signupPasswordError("a".repeat(72))).toBeNull();
    expect(signupPasswordError("a".repeat(73))).toBe("Use no more than 72 characters.");
  });
});
