import { describe, expect, it } from "vitest";
import { eventCategoryLabel, eventDate, eventFailureCopy, eventInvitation, eventPrice, eventRefreshAt, eventSchedule } from "./eventPresentation";
import type { EventListingDto } from "../../types/events";
import { ApiError } from "../../api/errors";
import { translate } from "../../localization/translate";
import en from "../../localization/resources/en.json";
import hi from "../../localization/resources/hi.json";
import te from "../../localization/resources/te.json";

describe("event presentation and invitation contract", () => {
  const event: EventListingDto = {
    id: "b945a299-7aef-4706-b479-eeaa8e9f8594", version: 3, status: "PUBLISHED", title: "Music evening",
    description: "Community performance", category: "MUSIC", city: "Hyderabad", locality: "Madhapur",
    venueName: "Arts centre", venueAddress: "Madhapur, Hyderabad", startsAt: "2026-10-30T12:00:00Z",
    endsAt: "2026-10-30T14:00:00Z", timezone: "Asia/Kolkata", priceMinPaise: null, priceMaxPaise: null,
    currency: "INR", sourceUrl: "https://example.com", sourceName: "Organizer", bookingUrl: null,
    imageUrl: null, verifiedAt: "2026-10-29T10:00:00Z", saved: false, unavailable: false,
  };
  it("distinguishes unknown, free and paid prices without losing paise", () => {
    expect(eventPrice(event)).toBe("Price not confirmed");
    expect(eventPrice({ ...event, priceMinPaise: 0, priceMaxPaise: 0 })).toBe("Free entry");
    expect(eventPrice({ ...event, priceMinPaise: 9950, priceMaxPaise: 9950 })).toContain("99.50");
  });
  it("formats the organizer timezone rather than the phone timezone", () => {
    expect(eventSchedule(event)).toMatch(/5:30/);
  });
  it("preserves listing version and retry identity in existing DatePlan requests", () => {
    expect(eventInvitation(event, "retry-key")).toMatchObject({
      eventId: event.id, eventVersion: 3, idempotencyKey: "retry-key", activityType: "EVENT",
      proposedStartAt: event.startsAt, durationMinutes: 120, venueAddress: event.venueAddress,
    });
  });
  it.each(["en", "hi", "te"] as const)("uses %s copy and date/currency formatting without changing the source timezone", language => {
    const t = (key: string, params?: Record<string, string | number>) => translate(language, "standard", key, params);
    expect(eventPrice(event, language)).toBe(t("events.price.unknown"));
    expect(eventPrice({ ...event, priceMinPaise: 0, priceMaxPaise: 0 }, language)).toBe(t("events.free"));
    expect(eventPrice({ ...event, priceMinPaise: 9950, priceMaxPaise: 9950 }, language)).toBe(new Intl.NumberFormat(`${language}-IN`, { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(99.5));
    expect(eventCategoryLabel("MUSIC", t)).toBe(t("events.category.MUSIC"));
    expect(eventSchedule(event, language)).toBe(new Intl.DateTimeFormat(`${language}-IN`, { timeZone: event.timezone, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(event.startsAt)));
    expect(eventDate(event.verifiedAt, event.timezone, language, { year: "numeric" })).toBe("2026");
    expect(eventFailureCopy(new ApiError(403, null), t, "events.detail.load.error")).toBe(t("events.error.connection"));
  });
  it("has matching Events keys and interpolation contracts in every supported language", () => {
    const keys = (resource: Record<string, string>) => Object.keys(resource).filter(key => key.startsWith("events.")).sort();
    const placeholders = (value: string) => value.match(/\{\{\w+\}\}/g)?.sort() ?? [];
    expect(keys(hi)).toEqual(keys(en)); expect(keys(te)).toEqual(keys(en));
    for (const key of keys(en)) {
      expect(placeholders((hi as Record<string, string>)[key]!)).toEqual(placeholders((en as Record<string, string>)[key]!));
      expect(placeholders((te as Record<string, string>)[key]!)).toEqual(placeholders((en as Record<string, string>)[key]!));
    }
    expect(hi["events.detail.invite"]).not.toBe(en["events.detail.invite"]);
    expect(te["events.detail.invite"]).not.toBe(en["events.detail.invite"]);
  });
  it("uses the server's review/start deadline with clock skew and stops scheduling unavailable events", () => {
    const received = Date.parse("2026-10-29T12:00:00Z");
    expect(eventRefreshAt({ ...event, serverNow: "2030-01-01T00:00:00Z", availableUntil: "2030-01-01T00:00:10Z" }, received)).toBe(received + 10000);
    expect(eventRefreshAt({ ...event, serverNow: "2030-01-01T00:00:10Z", availableUntil: "2030-01-01T00:00:00Z" }, received)).toBe(received);
    expect(eventRefreshAt({ ...event, unavailable: true }, received)).toBeNull();
  });
});
