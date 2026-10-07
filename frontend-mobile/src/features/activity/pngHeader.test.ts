import { describe, expect, it } from "vitest";
import { recapPngSize } from "./pngHeader";
describe("export PNG geometry verification", () => {
  it("reads native PNG dimensions from its header, not a requested size alone", () => {
    // Header fixture only; no image is generated or captured for this test.
    const bytes = [
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 4, 56, 0, 0, 7, 128,
    ];
    expect(recapPngSize(btoa(String.fromCharCode(...bytes)))).toEqual({
      width: 1080,
      height: 1920,
    });
  });
  it("rejects truncated/malformed output before exposing it to a share receiver", () => {
    expect(() => recapPngSize("not a png")).toThrow();
    expect(() => recapPngSize("iVBORw0KGgo=")).toThrow();
  });
});
