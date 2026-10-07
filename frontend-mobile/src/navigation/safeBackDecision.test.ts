import { describe, expect, it } from "vitest";
import { chooseSafeBackAction } from "./safeBackDecision";

describe("safe back navigation", () => {
  it("uses the navigation stack when one exists", () => {
    expect(chooseSafeBackAction(true)).toBe("back");
  });

  it("uses the explicit fallback for a direct link", () => {
    expect(chooseSafeBackAction(false)).toBe("replace");
  });
});
