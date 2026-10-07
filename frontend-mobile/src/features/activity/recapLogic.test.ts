import { describe, expect, it } from "vitest";
import type { WeeklyRecap } from "../../types/activity";
import {
  RECAP_EXPORT,
  recapHasActivity,
  recapPeriod,
  recapPeriodLabel,
  recapPreviewSize,
  recapShareModel,
} from "./recapLogic";
const recap: WeeklyRecap = {
  id: "private-report-id",
  periodStart: "2026-09-20T14:30:00Z",
  periodEnd: "2026-09-27T14:30:00Z",
  version: 1,
  generatedAt: "2026-09-27T14:35:00Z",
  scenesPublished: 12,
  plansAccepted: 3,
  activityDays: 4,
  pointsEarned: 150,
  historyStartedAt: "2026-09-23T00:00:00Z",
  partialHistory: true,
  historyAvailable: true,
};
describe("private recap / manual story model", () => {
  it.each([180, 280, 440])(
    "keeps preview inside %ddp height while leaving fixed actions reachable",
    (height) => {
      const size = recapPreviewSize(360, height);
      expect(size.height).toBeLessThanOrEqual(height);
      expect(size.width / size.height).toBeCloseTo(9 / 16);
    },
  );
  it("retains actual endpoints in the compact label, including a year boundary", () => {
    const label = recapPeriodLabel({
      ...recap,
      periodStart: "2026-12-27T14:30:00Z",
      periodEnd: "2027-01-03T14:30:00Z",
    });
    expect(label).toContain("27 Dec 2026");
    expect(label).toContain("3 Jan 2027");
  });
  it("does not describe a report with earned points/activity days as quiet", () => {
    const empty = {
      ...recap,
      scenesPublished: 0,
      plansAccepted: 0,
      activityDays: 0,
      pointsEarned: 0,
    };
    expect(recapHasActivity(empty)).toBe(false);
    expect(recapHasActivity({ ...empty, pointsEarned: 10 })).toBe(true);
    expect(recapHasActivity({ ...empty, activityDays: 1 })).toBe(true);
  });
  it.each([220, 248, 288, 388])(
    "keeps preview at real 9:16 inside %ddp without aspect/max-width stretching",
    (width) => {
      const size = recapPreviewSize(width);
      expect(size.width).toBeLessThanOrEqual(width);
      expect(size.width / size.height).toBeCloseTo(9 / 16);
    },
  );
  it("excludes private metrics by default and never copies unknown or identity fields", () => {
    const extended = {
      ...recap,
      accountToken: "secret",
      chat: "private chat",
      exactVenue: "private place",
    };
    const model = recapShareModel(extended);
    expect(model.metrics).toEqual([]);
    expect(model.partial).toBe(false);
    expect(JSON.stringify(model)).not.toMatch(/private|secret|150|12|exactVenue|accountToken/);
  });
  it("includes only actual allowed facts after explicit selection, not attendance", () => {
    const model = recapShareModel(recap, true);
    expect(model.metrics.map((metric) => metric.value)).toEqual([12, 3, 4, 150]);
    expect(model.metrics[1].label).toBe("Plans accepted");
    expect(model.partial).toBe(true);
    expect(JSON.stringify(model)).not.toMatch(/attended|travel|private-report-id/);
  });
  it("does not misrepresent missing history as measured zero activity", () => {
    expect(recapShareModel({ ...recap, historyAvailable: false }, true).metrics).toEqual([]);
    expect(
      recapShareModel(
        { ...recap, scenesPublished: 0, plansAccepted: 0, activityDays: 0, pointsEarned: 0 },
        true,
      ).metrics.map((m) => m.value),
    ).toEqual([0, 0, 0, 0]);
  });
  it("labels exact closed interval in IST and exports 9:16 with safe margins", () => {
    const period = recapPeriod(recap);
    expect(period.start).toContain("20 Sept 2026");
    expect(period.end).toContain("27 Sept 2026");
    expect(period.start).toMatch(/8:00/);
    expect(RECAP_EXPORT.width / RECAP_EXPORT.height).toBe(9 / 16);
  });
});
