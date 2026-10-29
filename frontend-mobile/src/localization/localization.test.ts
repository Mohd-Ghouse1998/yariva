import { afterEach, describe, expect, it, vi } from "vitest";
import { translate } from "./translate";

describe("localization", () => {
  afterEach(() => vi.unstubAllGlobals());
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

  it.each(["available", "unavailable"])("uses locale-aware Scene streak copy when PluralRules is %s", availability => {
    if (availability === "unavailable") {
      vi.stubGlobal("Intl", Object.create(Intl, { PluralRules: { value: undefined } }));
    }
    const expected = {
      en: [["No Scene streak yet", "Best · no streak yet"], ["1 day", "Best · 1 day"], ["2 days", "Best · 2 days"]],
      hi: [["अभी कोई सीन स्ट्रीक नहीं", "सबसे लंबी · अभी कोई स्ट्रीक नहीं"], ["1 दिन", "सबसे लंबी · 1 दिन"], ["2 दिन", "सबसे लंबी · 2 दिन"]],
      te: [["ఇంకా సీన్ స్ట్రీక్ లేదు", "ఉత్తమం · ఇంకా స్ట్రీక్ లేదు"], ["1 రోజు", "ఉత్తమం · 1 రోజు"], ["2 రోజులు", "ఉత్తమం · 2 రోజులు"]],
    } as const;
    for (const language of ["en", "hi", "te"] as const) {
      for (const days of [0, 1, 2]) {
        expect(translate(language, "standard", "activity.days", { days })).toBe(expected[language][days]![0]);
        expect(translate(language, "standard", "activity.longest", { days })).toBe(expected[language][days]![1]);
      }
    }
  });
});
