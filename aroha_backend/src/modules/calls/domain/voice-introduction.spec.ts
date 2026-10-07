import { selectIntroductionPrompt } from "./voice-introduction";

describe("voice introduction topics", () => {
  it("uses a shared Scene topic only for two same-intent Scenes", () => {
    expect(selectIntroductionPrompt([{ activityTokens: ["coffee"], intent: "DATING" }, { activityTokens: ["coffee", "books"], intent: "DATING" }])).toBe("coffee");
    expect(selectIntroductionPrompt([{ activityTokens: ["coffee"], intent: "DATING" }, { activityTokens: ["coffee"], intent: "FRIENDSHIP" }])).toBe("general");
  });
  it("falls back without exposing Scene text or requiring a Scene", () => {
    expect(selectIntroductionPrompt([])).toBe("general");
    expect(selectIntroductionPrompt([{ activityTokens: ["private-place"], intent: "DATING" }])).toBe("general");
    expect(selectIntroductionPrompt([{ activityTokens: ["walk"], intent: "DATING" }, { activityTokens: ["coffee"], intent: "DATING" }])).toBe("general");
  });
});
