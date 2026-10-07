import { describe, expect, it } from "vitest";
import { discoveryPhotoHeight } from "./discoveryLayout";
describe("compact discovery viewport budget", () => {
  it("keeps decisions in the available viewport without changing text size", () => {
    expect(discoveryPhotoHeight(360, 392)).toBe(392);
    expect(discoveryPhotoHeight(320, 340)).toBe(340);
  });
  it("fills tall pages without an aspect-ratio cap and never overflows short pages", () => {
    expect(discoveryPhotoHeight(320, 200)).toBe(200);
    expect(discoveryPhotoHeight(360, 700)).toBe(700);
    expect(discoveryPhotoHeight(360, 340)).toBe(340);
    expect(discoveryPhotoHeight(360)).toBe(456);
  });
});
