import {
  isSceneActive,
  isWithinSceneRadius,
  normalizeSceneActivity,
  normalizeSceneTags,
  sceneActivitiesOverlap,
  sceneWindowsOverlap,
} from "./scenes.domain";

describe("Scene domain rules", () => {
  it("normalizes aliases and ignores filler words", () => {
    expect(normalizeSceneActivity("  A café walk tonight  ")).toEqual({
      activity: "A café walk tonight",
      canonicalActivity: "coffee-walk",
      activityTokens: ["coffee", "walk"],
    });
    expect(
      sceneActivitiesOverlap(
        normalizeSceneActivity("Coffee and books"),
        normalizeSceneActivity("Chai with a book"),
      ),
    ).toBe(true);
    expect(
      sceneActivitiesOverlap(
        normalizeSceneActivity("Coffee"),
        normalizeSceneActivity("Badminton"),
      ),
    ).toBe(false);
  });

  it("deduplicates and bounds canonical tags", () => {
    expect(normalizeSceneTags(["Quiet", "quiet", " KBR-Park ", "not_valid!"])).toEqual([
      "kbr-park",
      "quiet",
    ]);
  });

  it("treats only two complete overlapping windows as confirmed", () => {
    const base = new Date("2026-09-23T10:00:00.000Z");
    expect(
      sceneWindowsOverlap(
        { availableFrom: base, availableUntil: new Date("2026-09-23T12:00:00.000Z") },
        {
          availableFrom: new Date("2026-09-23T11:00:00.000Z"),
          availableUntil: new Date("2026-09-23T13:00:00.000Z"),
        },
      ),
    ).toBe("CONFIRMED");
    expect(
      sceneWindowsOverlap(
        { availableFrom: base, availableUntil: new Date("2026-09-23T11:00:00.000Z") },
        {
          availableFrom: new Date("2026-09-23T11:00:00.000Z"),
          availableUntil: new Date("2026-09-23T12:00:00.000Z"),
        },
      ),
    ).toBe("NONE");
    expect(
      sceneWindowsOverlap(
        { availableFrom: null, availableUntil: null },
        { availableFrom: base, availableUntil: new Date("2026-09-23T12:00:00.000Z") },
      ),
    ).toBe("UNCONFIRMED");
  });

  it("uses an inclusive 15 km boundary and exact expiry", () => {
    expect(isWithinSceneRadius(14_900)).toBe(true);
    expect(isWithinSceneRadius(15_000)).toBe(true);
    expect(isWithinSceneRadius(15_100)).toBe(false);

    const now = new Date("2026-09-23T12:00:00.000Z");
    expect(isSceneActive({ status: "ACTIVE", expiresAt: new Date(now.getTime() + 1) }, now)).toBe(
      true,
    );
    expect(isSceneActive({ status: "ACTIVE", expiresAt: now }, now)).toBe(false);
    expect(isSceneActive({ status: "ENDED", expiresAt: new Date(now.getTime() + 1) }, now)).toBe(
      false,
    );
  });
});
