import { describe, expect, it } from "vitest";
import {
  BOTTOM_NAV_CONTENT_GAP,
  BOTTOM_NAV_VISUAL_HEIGHT,
  getBottomNavigationMetrics,
} from "./bottomNavigation";

describe("bottom navigation metrics", () => {
  it("reserves the visual dock, safe-area offset and content gap", () => {
    const metrics = getBottomNavigationMetrics(24);
    expect(metrics.visualHeight).toBe(BOTTOM_NAV_VISUAL_HEIGHT);
    expect(metrics.reservedInset).toBe(
      metrics.edgeOffset + BOTTOM_NAV_VISUAL_HEIGHT + BOTTOM_NAV_CONTENT_GAP,
    );
  });

  it("keeps a minimum edge offset when a device reports no bottom inset", () => {
    expect(getBottomNavigationMetrics(0).edgeOffset).toBe(14);
  });
});

