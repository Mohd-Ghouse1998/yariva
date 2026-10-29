import { describe, expect, it } from "vitest";
import { sceneAvailability, sceneElapsedProgress, sceneRemainingLabel } from "./sceneTime";

describe("Scene time presentation", () => {
  const createdAt = "2026-09-23T00:00:00.000Z";
  const expiresAt = "2026-09-23T12:00:00.000Z";

  it("shows the compact remaining lifetime", () => {
    const now = Date.parse("2026-09-23T01:20:00.000Z");
    expect(sceneRemainingLabel(expiresAt, now)).toBe("10h 40m");
  });

  it("derives progress from server timestamps", () => {
    const halfway = Date.parse("2026-09-23T06:00:00.000Z");
    expect(sceneElapsedProgress(createdAt, expiresAt, halfway)).toBe(0.5);
  });

  it("clamps progress before creation and after expiry", () => {
    expect(sceneElapsedProgress(createdAt, expiresAt, Date.parse("2026-09-22T23:00:00.000Z"))).toBe(
      0,
    );
    expect(sceneElapsedProgress(createdAt, expiresAt, Date.parse("2026-09-23T13:00:00.000Z"))).toBe(
      1,
    );
  });
});

describe("Scene availability edits", () => {
  const now = Date.parse("2026-10-23T10:00:00.000Z");
  const scene = {
    availableFrom: "2026-10-23T09:00:00.000Z",
    availableUntil: "2026-10-23T11:00:00.000Z",
    expiresAt: "2026-10-23T11:30:00.000Z",
  };
  it("preserves the exact original window unless explicitly changed", () => {
    expect(sceneAvailability(scene, null, now, 12)).toEqual({
      availableFrom: scene.availableFrom,
      availableUntil: scene.availableUntil,
    });
    expect(sceneAvailability(scene, "FLEXIBLE", now, 12)).toEqual({
      availableFrom: null,
      availableUntil: null,
    });
  });
  it("bounds a changed window to the existing server expiry", () => {
    const result = sceneAvailability(scene, "NEXT_TWO_HOURS", now, 12);
    expect(Date.parse(result.availableFrom!)).toBe(now);
    expect(Date.parse(result.availableUntil!)).toBe(Date.parse(scene.expiresAt) - 1000);
  });
  it("uses the capability lifetime for new Scenes and avoids invalid near-expiry windows", () => {
    const result = sceneAvailability(null, "NEXT_TWO_HOURS", now, 1);
    expect(Date.parse(result.availableUntil!)).toBe(now + 3600000 - 1000);
    expect(
      sceneAvailability(
        { ...scene, expiresAt: new Date(now + 30000).toISOString() },
        "TONIGHT",
        now,
        12,
      ),
    ).toEqual({ availableFrom: null, availableUntil: null });
  });
});
