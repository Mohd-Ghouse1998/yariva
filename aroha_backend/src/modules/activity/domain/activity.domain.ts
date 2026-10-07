const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
export const RECAP_VERSION = 1;
export const istDay = (now: Date): string =>
  new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
export const displayedStreak = (
  current: number,
  last: Date | null,
  now: Date,
): number => {
  if (!last) return 0;
  const day = new Date(`${istDay(now)}T00:00:00Z`).getTime();
  const delta =
    (day - new Date(`${last.toISOString().slice(0, 10)}T00:00:00Z`).getTime()) /
    DAY_MS;
  return delta === 0 || delta === 1 ? current : 0;
};
/** Last closed Sunday-20:00 IST reporting week; end is exclusive. */
export const closedRecapPeriod = (now: Date): { start: Date; end: Date } => {
  const local = new Date(now.getTime() + IST_OFFSET_MS);
  const sunday =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() - local.getUTCDay(),
      20,
    ) - IST_OFFSET_MS;
  const end = new Date(sunday <= now.getTime() ? sunday : sunday - 7 * DAY_MS);
  return { start: new Date(end.getTime() - 7 * DAY_MS), end };
};
