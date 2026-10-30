import { createHash } from "node:crypto";
import { AppException } from "../../common/errors/app.exception";
import { ERROR_CODES } from "../../common/constants/error-codes";
import type { EventListing } from "../../generated/prisma/client";
import type { CurateEventDto } from "./events.dto";

export const EVENT_FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;
export function invalidEvent(message: string): never {
  throw new AppException(400, ERROR_CODES.VALIDATION_FAILED, message);
}

export { publicHttpsUrl } from "../../common/utils/public-https-url";
import { publicHttpsUrl } from "../../common/utils/public-https-url";

export function eventUnavailable(event: Pick<EventListing, "status" | "startsAt" | "verifiedAt">, now = new Date()): boolean {
  return event.status !== "PUBLISHED" || event.startsAt <= now || !eventFresh(event, now);
}

export function eventFresh(event: Pick<EventListing, "verifiedAt">, now = new Date()): boolean {
  return event.verifiedAt.getTime() >= now.getTime() - EVENT_FRESHNESS_MS && event.verifiedAt <= now;
}

export function curateEventData(input: CurateEventDto, now = new Date()) {
  if ((input.latitude == null) !== (input.longitude == null)) invalidEvent("Provide both venue coordinates, or neither");
  const startsAt = new Date(input.startsAt), endsAt = new Date(input.endsAt), verifiedAt = new Date(input.verifiedAt);
  if (![startsAt, endsAt, verifiedAt].every((value) => Number.isFinite(value.getTime())) || endsAt <= startsAt || verifiedAt > now) invalidEvent("Invalid event schedule or verification time");
  if (Math.ceil((endsAt.getTime() - startsAt.getTime()) / 60000) > 2147483647) invalidEvent("Event duration exceeds the supported range");
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(startsAt); }
  catch { invalidEvent("Use a valid IANA timezone"); }
  const priceMinPaise = input.priceMinPaise ?? null, priceMaxPaise = input.priceMaxPaise ?? null;
  if ((priceMinPaise === null) !== (priceMaxPaise === null) ||
      (priceMinPaise !== null && (priceMinPaise < 0 || priceMaxPaise! < priceMinPaise))) invalidEvent("Provide both price bounds, or leave both unknown");
  if (input.imageUrl && !input.imageRights?.trim()) invalidEvent("Image usage rights must be recorded");
  const text = (value: string) => { if (!value.trim()) invalidEvent("Event text cannot be blank"); return value.trim(); };
  const title = text(input.title), venueName = text(input.venueName), city = text(input.city);
  const data = {
    latitude: input.latitude ?? null, longitude: input.longitude ?? null,
    status: input.status, title, description: text(input.description), category: input.category,
    city, locality: text(input.locality), venueName, venueAddress: text(input.venueAddress), startsAt, endsAt,
    timezone: input.timezone, priceMinPaise, priceMaxPaise, currency: "INR",
    sourceUrl: publicHttpsUrl(input.sourceUrl), sourceName: text(input.sourceName),
    bookingUrl: input.bookingUrl ? publicHttpsUrl(input.bookingUrl) : null,
    imageUrl: input.imageUrl ? publicHttpsUrl(input.imageUrl) : null,
    imageRights: input.imageUrl ? text(input.imageRights!) : null, verifiedAt,
    dedupeKey: createHash("sha256").update([title, city, venueName, startsAt.toISOString()].map((v) => v.toLowerCase().replace(/\s+/g, " ")).join("|")).digest("hex"),
  };
  if (input.status === "PUBLISHED" && eventUnavailable(data, now)) invalidEvent("Published listings must be upcoming and verified in the past seven days");
  return data;
}

export function isActiveAdult(user: { status: string; deletedAt: Date | null; profile: { dateOfBirth: Date | null } | null }, now = new Date()): boolean {
  const dob = user.profile?.dateOfBirth;
  const adultOn = dob ? new Date(Date.UTC(dob.getUTCFullYear() + 18, dob.getUTCMonth(), dob.getUTCDate())) : null;
  return user.status === "ACTIVE" && !user.deletedAt && adultOn !== null && adultOn <= now;
}
