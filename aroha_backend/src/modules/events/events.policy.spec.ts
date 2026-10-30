import { curateEventData, eventUnavailable, isActiveAdult, publicHttpsUrl } from "./events.policy";
import type { CurateEventDto } from "./events.dto";

describe("curated event policy", () => {
  const now = new Date("2026-10-29T10:00:00Z");
  const input: CurateEventDto = {
    expectedVersion: 0, status: "PUBLISHED", title: " Community music ", description: "An evening of music",
    category: "MUSIC", city: "Hyderabad", locality: "Madhapur", venueName: "Public arts centre",
    venueAddress: "Madhapur, Hyderabad", startsAt: "2026-10-30T12:00:00Z", endsAt: "2026-10-30T14:00:00Z",
    timezone: "Asia/Kolkata", sourceUrl: "https://example.com/music#tickets", sourceName: "Organizer",
    verifiedAt: now.toISOString(),
  };
  it("normalizes sources and deduplicates equivalent listing text", () => {
    const first = curateEventData(input, now);
    const second = curateEventData({ ...input, title: "community  MUSIC" }, now);
    expect(first.title).toBe("Community music");
    expect(first.sourceUrl).toBe("https://example.com/music");
    expect(first.dedupeKey).toBe(second.dedupeKey);
    expect(first.priceMinPaise).toBeNull();
  });
  it.each(["http://example.com", "https://127.0.0.1/x", "https://[::1]/", "https://host.local/", "https://localhost./", "https://host.local./", "https://host.internal/", "https://user:pass@example.com", "https://example.com:8443"])("rejects unsafe source %s", (url) => {
    expect(() => publicHttpsUrl(url)).toThrow();
  });
  it.each([
    { endsAt: input.startsAt }, { timezone: "Invalid/Zone" }, { priceMinPaise: 100 },
    { priceMinPaise: 200, priceMaxPaise: 100 }, { imageUrl: "https://example.com/photo.jpg" },
    { verifiedAt: "2026-10-29T11:00:00Z" }, { verifiedAt: "2026-10-20T10:00:00Z" },
    { title: "  " }, { endsAt: "9999-12-31T00:00:00Z" },
  ])("rejects invalid or unreviewed data %j", (override) => {
    expect(() => curateEventData({ ...input, ...override }, now)).toThrow();
  });
  it("treats cancellation, expired review and event start as unavailable", () => {
    const event = curateEventData(input, now);
    expect(eventUnavailable(event, now)).toBe(false);
    expect(eventUnavailable({ ...event, status: "CANCELLED" }, now)).toBe(true);
    expect(eventUnavailable(event, event.startsAt)).toBe(true);
    expect(eventUnavailable({ ...event, verifiedAt: new Date("2026-10-20") }, now)).toBe(true);
  });
  it("shares exact UTC adult eligibility between discovery and private event notices", () => {
    const user = { status: "ACTIVE", deletedAt: null, profile: { dateOfBirth: new Date("2008-10-29T00:00:00Z") } };
    expect(isActiveAdult(user, new Date("2026-10-28T23:59:59.999Z"))).toBe(false);
    expect(isActiveAdult(user, new Date("2026-10-29T00:00:00Z"))).toBe(true);
    expect(isActiveAdult({ ...user, profile: null }, now)).toBe(false);
    expect(isActiveAdult({ ...user, status: "RESTRICTED" }, now)).toBe(false);
    expect(isActiveAdult({ ...user, deletedAt: now }, now)).toBe(false);
  });
});
