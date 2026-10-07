import { closedRecapPeriod, displayedStreak, istDay } from "./activity.domain";
describe("Activity IST policy", () => {
  it("uses the IST midnight, not UTC or device timezone", () => {
    expect(istDay(new Date("2026-09-29T18:29:59Z"))).toBe("2026-09-29");
    expect(istDay(new Date("2026-09-29T18:30:00Z"))).toBe("2026-09-30");
  });
  it("shows zero after a missed day without changing the ledger", () => {
    expect(
      displayedStreak(
        5,
        new Date("2026-09-28"),
        new Date("2026-09-29T12:00:00Z"),
      ),
    ).toBe(5);
    expect(
      displayedStreak(
        5,
        new Date("2026-09-27"),
        new Date("2026-09-29T12:00:00Z"),
      ),
    ).toBe(0);
    expect(
      displayedStreak(
        5,
        new Date("2026-09-30"),
        new Date("2026-09-29T12:00:00Z"),
      ),
    ).toBe(0);
    expect(displayedStreak(0, null, new Date())).toBe(0);
  });
  it("moves the period only at the exclusive Sunday 20 IST cutoff", () => {
    expect(
      closedRecapPeriod(new Date("2026-10-04T14:29:59Z")).end.toISOString(),
    ).toBe("2026-09-27T14:30:00.000Z");
    const period = closedRecapPeriod(new Date("2026-10-04T14:30:00Z"));
    expect(period.start.toISOString()).toBe("2026-09-27T14:30:00.000Z");
    expect(period.end.toISOString()).toBe("2026-10-04T14:30:00.000Z");
  });
});
