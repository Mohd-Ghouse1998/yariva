import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsPlaceUrl,
  buildGoogleMapsSearchUrl,
  createInitialPlanDateTime,
  createQuickMeetupDateTime,
  firstRouteParam,
  formatLocalDateValue,
  formatLocalTimeValue,
  isSameMinute,
  parseLocalDateTime,
} from "./datePlanLogic";

describe("date-plan date and time input", () => {
  it("normalizes route params without trusting missing or repeated values", () => {
    expect(firstRouteParam(undefined)).toBeNull();
    expect(firstRouteParam("  match-1 ")).toBe("match-1");
    expect(firstRouteParam(["match-1", "match-2"])).toBe("match-1");
  });

  it("accepts an arbitrary valid future local date and time", () => {
    const now = new Date(2026, 7, 30, 9, 0, 0, 0);
    const result = parseLocalDateTime("2026-09-14", "20:45", now);

    expect(result.error).toBeNull();
    expect(result.iso).not.toBeNull();
    expect(new Date(result.iso as string).getFullYear()).toBe(2026);
    expect(new Date(result.iso as string).getHours()).toBe(20);
    expect(new Date(result.iso as string).getMinutes()).toBe(45);
  });

  it("rejects impossible, malformed, and past values", () => {
    const now = new Date(2026, 7, 30, 9, 0, 0, 0);
    expect(parseLocalDateTime("2026-02-30", "18:30", now).iso).toBeNull();
    expect(parseLocalDateTime("30/08/2026", "18:30", now).iso).toBeNull();
    expect(parseLocalDateTime("2026-08-30", "25:00", now).iso).toBeNull();
    expect(parseLocalDateTime("2026-08-29", "18:30", now).iso).toBeNull();
  });

  it("creates an editable default rather than a fixed evening slot", () => {
    const initial = createInitialPlanDateTime(new Date(2026, 7, 30, 9, 23, 0, 0));
    expect(initial).toEqual({ date: "2026-08-31", time: "10:00" });
  });

  it("formats local values used by the reschedule form", () => {
    const value = new Date(2026, 10, 4, 7, 5, 0, 0);
    expect(formatLocalDateValue(value)).toBe("2026-11-04");
    expect(formatLocalTimeValue(value)).toBe("07:05");
  });
});

describe("casual meetup shortcuts", () => {
  it("creates useful quick times without requiring an availability form", () => {
    const now = new Date(2026, 8, 23, 10, 0, 0, 0);
    expect(createQuickMeetupDateTime("TONIGHT", now)).toEqual({ date: "2026-09-23", time: "19:00" });
    expect(createQuickMeetupDateTime("TOMORROW", now)).toEqual({ date: "2026-09-24", time: "18:30" });
    expect(createQuickMeetupDateTime("WEEKEND", now)).toEqual({ date: "2026-09-26", time: "16:00" });
  });

  it("builds encoded universal Google Maps URLs without an API key", () => {
    expect(buildGoogleMapsSearchUrl("cafes", "Jubilee Hills")).toContain(
      "query=cafes%20in%20Jubilee%20Hills",
    );
    expect(buildGoogleMapsPlaceUrl("Test Café", "Road 1, Hyderabad")).toContain(
      "query=Test%20Caf%C3%A9%2C%20Road%201%2C%20Hyderabad",
    );
  });
});

describe("reschedule comparison", () => {
  it("compares proposals to the minute", () => {
    expect(isSameMinute("2026-09-14T12:00:01.000Z", "2026-09-14T12:00:59.000Z")).toBe(true);
    expect(isSameMinute("2026-09-14T12:00:00.000Z", "2026-09-14T12:01:00.000Z")).toBe(false);
  });
});
