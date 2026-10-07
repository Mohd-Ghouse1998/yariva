import { describe, expect, it } from "vitest";
import { sceneElapsedProgress, sceneRemainingLabel } from "./sceneTime";

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
    expect(sceneElapsedProgress(createdAt, expiresAt, Date.parse("2026-09-22T23:00:00.000Z"))).toBe(0);
    expect(sceneElapsedProgress(createdAt, expiresAt, Date.parse("2026-09-23T13:00:00.000Z"))).toBe(1);
  });
});
