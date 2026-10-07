export const BLIND_POLICY = Object.freeze({ perParticipantTarget: 5, initialBlurRadius: 20, minimumContributionIntervalSeconds: 10 });
export const IST_OFFSET_MS = 330 * 60_000;
export function effectiveEventState(event: { cancelledAt: Date | null; startsAt: Date; endsAt: Date }, now = new Date()) {
  return event.cancelledAt ? "CANCELLED" : now >= event.endsAt ? "ENDED" : now >= event.startsAt ? "LIVE" : "UPCOMING";
}
export function nextThursday(now: Date, weekday = 4, hour = 20, durationMinutes = 120) {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) throw new Error("Invalid Blind event schedule");
  const local = new Date(now.getTime() + IST_OFFSET_MS);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + (weekday - local.getUTCDay() + 7) % 7, hour) - IST_OFFSET_MS);
  if (start.getTime() + durationMinutes * 60_000 <= now.getTime()) start.setUTCDate(start.getUTCDate() + 7);
  return { startsAt: start, endsAt: new Date(start.getTime() + durationMinutes * 60_000) };
}
