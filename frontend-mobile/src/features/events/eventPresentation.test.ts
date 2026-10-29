import { describe, expect, it } from "vitest";
import { eventInvitation, eventPrice, eventSchedule } from "./eventPresentation";
import type { EventListingDto } from "../../types/events";

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
});
