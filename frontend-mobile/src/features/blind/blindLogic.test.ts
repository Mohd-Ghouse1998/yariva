import { describe, expect, it } from "vitest";
import { blindPresentation } from "./blindLogic";
describe("server-derived Blind presentation", () => {
  const policy = { isBlindVibeActive: true, interactionCount: 4, revealThreshold: 10, initialBlurRadius: 20 };
  it("clamps progress and never divides by an invalid threshold", () => {
    expect(blindPresentation(policy)).toEqual({ count: 4, progress: 0.4, blurRadius: 12 });
    expect(blindPresentation({ ...policy, interactionCount: 999 }).count).toBe(10);
    for (const revealThreshold of [0, -1, NaN]) expect(blindPresentation({ ...policy, revealThreshold })).toEqual({ count: 0, progress: 0, blurRadius: 20 });
    expect(blindPresentation({ ...policy, interactionCount: NaN }).progress).toBe(0);
    expect(blindPresentation({ ...policy, isBlindVibeActive: false }).blurRadius).toBe(0);
  });
});
