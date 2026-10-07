import {
  DAILY_CURATED_PROFILE_LIMIT,
  clampCuratedProfileLimit,
} from "./discovery.services";

describe("intentional discovery limit", () => {
  it("never returns more than the daily curated limit", () => {
    expect(DAILY_CURATED_PROFILE_LIMIT).toBe(8);
    expect(clampCuratedProfileLimit()).toBe(8);
    expect(clampCuratedProfileLimit(50)).toBe(8);
    expect(clampCuratedProfileLimit(4)).toBe(4);
    expect(clampCuratedProfileLimit(0)).toBe(1);
  });
});
