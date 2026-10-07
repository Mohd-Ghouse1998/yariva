import { effectiveEventState, nextThursday } from "./blind-policy";
describe("Blind event IST boundaries", () => {
  const event = { startsAt: new Date("2026-10-01T14:30:00Z"), endsAt: new Date("2026-10-01T16:30:00Z"), cancelledAt: null };
  it("uses inclusive opening, exclusive closing and authoritative cancellation", () => {
    expect(effectiveEventState(event, new Date("2026-10-01T14:29:59.999Z"))).toBe("UPCOMING");
    expect(effectiveEventState(event, event.startsAt)).toBe("LIVE");
    expect(effectiveEventState(event, event.endsAt)).toBe("ENDED");
    expect(effectiveEventState({ ...event, cancelledAt: new Date() }, event.startsAt)).toBe("CANCELLED");
  });
  it("keeps the current live Thursday then advances exactly one week", () => {
    expect(nextThursday(event.startsAt).startsAt).toEqual(event.startsAt);
    expect(nextThursday(event.endsAt).startsAt.toISOString()).toBe("2026-10-08T14:30:00.000Z");
    expect(() => nextThursday(new Date(), 9)).toThrow();
  });
});
