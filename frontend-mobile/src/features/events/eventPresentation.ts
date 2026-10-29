import type { CreateDatePlanRequest } from "../../types/datePlan";
import type { EventCategory, EventListingDto } from "../../types/events";

export const eventCategoryLabels: Record<EventCategory, string> = {
  CULTURE: "Culture", MUSIC: "Music", FOOD: "Food", OUTDOORS: "Outdoors", WORKSHOP: "Workshops", COMMUNITY: "Community",
};

export function eventSchedule(event: Pick<EventListingDto, "startsAt" | "timezone">) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: event.timezone, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }).format(new Date(event.startsAt));
}

export function eventPrice(event: Pick<EventListingDto, "priceMinPaise" | "priceMaxPaise" | "currency">) {
  if (event.priceMinPaise === null || event.priceMaxPaise === null) return "Price not confirmed";
  if (event.priceMaxPaise === 0) return "Free entry";
  const format = (paise: number) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: event.currency, maximumFractionDigits: 2,
  }).format(paise / 100);
  return event.priceMinPaise === event.priceMaxPaise ? format(event.priceMinPaise) : `${format(event.priceMinPaise)}–${format(event.priceMaxPaise)}`;
}

// The server resolves the listing again and ignores client-supplied schedule/venue values.
export function eventInvitation(event: EventListingDto, idempotencyKey: string): CreateDatePlanRequest {
  return {
    eventId: event.id, eventVersion: event.version, idempotencyKey,
    title: event.title, description: event.description, activityType: "EVENT",
    proposedStartAt: event.startsAt, durationMinutes: Math.ceil((Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 60000),
    timezone: event.timezone, publicLocality: event.locality, venueName: event.venueName, venueAddress: event.venueAddress,
  };
}
