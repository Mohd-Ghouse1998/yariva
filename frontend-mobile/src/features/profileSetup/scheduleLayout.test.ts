import { describe, expect, it } from "vitest";
import { scheduleDayLayout } from "./scheduleLayout";
describe("weekday target layout", () => {
  it.each([240, 280, 300, 320, 360, 600])(
    "keeps non-overlapping targets at %ddp with normal and large text",
    (width) => {
      for (const scale of [1, 1.3]) {
        const { columns, gap, itemWidth } = scheduleDayLayout(width, scale);
        expect(itemWidth).toBeGreaterThanOrEqual(48);
        expect(columns * itemWidth + (columns - 1) * gap).toBeLessThanOrEqual(width + 0.001);
      }
    },
  );
  it("uses multiple rows on phones and one row when seven days fit", () => {
    expect(scheduleDayLayout(320, 1.3).columns).toBe(4);
    expect(scheduleDayLayout(600, 1.3).columns).toBe(7);
  });
});
