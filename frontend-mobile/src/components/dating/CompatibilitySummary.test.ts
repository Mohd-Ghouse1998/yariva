import { describe, expect, it } from "vitest";
import { uniqueCompatibilityReasons } from "./compatibilityReasons";

describe("uniqueCompatibilityReasons", () => {
  it("does not repeat the dedicated schedule-overlap message", () => {
    expect(
      uniqueCompatibilityReasons(
        ["Your usual availability overlaps", "Your relationship intentions align"],
        "Your usual availability overlaps",
      ),
    ).toEqual(["Your relationship intentions align"]);
  });

  it("removes duplicate and blank reasons without changing their display copy", () => {
    expect(
      uniqueCompatibilityReasons(
        ["Shared interests", " shared interests ", "", "Compatible pace"],
        null,
      ),
    ).toEqual(["Shared interests", "Compatible pace"]);
  });
});
