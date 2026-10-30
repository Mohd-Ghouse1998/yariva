import { ApiError } from "../../api/errors";
import { translate, type AppLanguage, type TranslationParams } from "../../localization/translate";
import type { CreateDatePlanRequest } from "../../types/datePlan";
import type { EventCategory, EventListingDto } from "../../types/events";

export type EventTranslator = (key: string, params?: TranslationParams) => string;
export const eventLocale = (language: AppLanguage = "en") => `${language}-IN`;
const english: EventTranslator = (key, params) => translate("en", "standard", key, params);
export const eventCategoryLabel = (category: EventCategory, t: EventTranslator = english) => t(`events.category.${category}`);

export function eventDate(instant: string, timezone: string, language: AppLanguage, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(eventLocale(language), { ...options, timeZone: timezone }).format(new Date(instant));
}
export function eventSchedule(event: Pick<EventListingDto, "startsAt" | "timezone">, language: AppLanguage = "en") {
  return eventDate(event.startsAt, event.timezone, language, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
export function eventPrice(event: Pick<EventListingDto, "priceMinPaise" | "priceMaxPaise" | "currency">, language: AppLanguage = "en", t: EventTranslator = (key, params) => translate(language, "standard", key, params)) {
  if (event.priceMinPaise === null || event.priceMaxPaise === null) return t("events.price.unknown");
  if (event.priceMaxPaise === 0) return t("events.free");
  const format = (paise: number) => new Intl.NumberFormat(eventLocale(language), { style: "currency", currency: event.currency, maximumFractionDigits: 2 }).format(paise / 100);
  return event.priceMinPaise === event.priceMaxPaise ? format(event.priceMinPaise) : `${format(event.priceMinPaise)}–${format(event.priceMaxPaise)}`;
}
export function eventFailureCopy(error: unknown, t: EventTranslator, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === "DATE_PLAN_UNSAFE_SUGGESTION") return t("events.error.unsafe");
    if (error.status === 401) return t("events.error.session");
    if (error.status === 403) return t("events.error.connection");
  }
  return t(fallback);
}
// Deadline is computed by the server. Account for device clock skew using the
// response's server time and when it was received; never duplicate review policy.
export function eventRefreshAt(event: EventListingDto, receivedAt: number): number | null {
  if (event.unavailable) return null;
  const until = Date.parse(event.availableUntil ?? event.startsAt);
  const serverNow = event.serverNow ? Date.parse(event.serverNow) : receivedAt;
  return Number.isFinite(until) && Number.isFinite(serverNow) ? receivedAt + Math.max(0, until - serverNow) : null;
}
export function eventInvitation(event: EventListingDto, idempotencyKey: string): CreateDatePlanRequest {
  return { eventId: event.id, eventVersion: event.version, idempotencyKey, title: event.title, description: event.description, activityType: "EVENT",
    proposedStartAt: event.startsAt, durationMinutes: Math.ceil((Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 60000), timezone: event.timezone,
    publicLocality: event.locality, venueName: event.venueName, venueAddress: event.venueAddress };
}
