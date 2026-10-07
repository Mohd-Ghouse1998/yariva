import { describe, expect, it } from "vitest";
import { introductionPromptKey } from "./introductionPrompt";
import { translate } from "../../localization/translate";
describe("voice hello copy", () => {
  it("uses a safe generic prompt for unknown/missing topics", () => {
    expect(introductionPromptKey("coffee")).toBe("hello.prompt.coffee");
    expect(introductionPromptKey("someone's raw scene")).toBe("hello.prompt.general");
    expect(introductionPromptKey()).toBe("hello.prompt.general");
  });
  it("provides explicit invitation and prompt copy in each supported language", () => {
    for (const language of ["en", "hi", "te"] as const) {
      expect(translate(language, "standard", "hello.invite", { name: "Asha" })).toContain("Asha");
      for (const topic of ["general", "coffee", "food", "walk", "study"]) {
        const key = introductionPromptKey(topic);
        expect(translate(language, "standard", key)).not.toBe(key);
      }
    }
  });
});
