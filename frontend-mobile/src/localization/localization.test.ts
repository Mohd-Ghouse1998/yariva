import { describe, expect, it } from "vitest";
import { translate } from "./translate";

describe("localization", () => {
  it("uses translated Scene keys, interpolates values, and falls back safely", () => {
    expect(translate("te", "standard", "scene.active.until", { time: "2h" })).toBe(
      "2h వరకు యాక్టివ్",
    );
    expect(translate("te", "standard", "settings.tone.title")).toBe("Hyderabad casual tone");
    expect(translate("hi", "standard", "unknown.key")).toBe("unknown.key");
  });

  it("applies casual copy independently of language", () => {
    expect(translate("en", "hyderabad-casual", "discovery.empty")).toBe(
      "Scene light undi right now, change your spot!",
    );
    expect(translate("te", "hyderabad-casual", "discovery.empty")).toBe(
      "Scene light undi right now, change your spot!",
    );
  });

  it("keeps the primary safety action explicit", () => {
    expect(translate("en", "hyderabad-casual", "safety.block.action")).toBe("Block");
    expect(translate("en", "hyderabad-casual", "safety.block.casualCandidate")).toBe(
      "Baigan mein mila do",
    );
  });
});
