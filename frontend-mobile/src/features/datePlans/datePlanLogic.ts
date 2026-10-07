const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_INPUT_PATTERN = /^(\d{2}):(\d{2})$/;

export type DateTimeInputResult =
  | { iso: string; error: null }
  | { iso: null; error: string };

export const firstRouteParam = (value: string | string[] | undefined): string | null => {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized?.trim() || null;
};

const pad2 = (value: number) => value.toString().padStart(2, "0");

export const formatLocalDateValue = (value: Date): string =>
  `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;

export const formatLocalTimeValue = (value: Date): string =>
  `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;

export const createInitialPlanDateTime = (now = new Date()): { date: string; time: string } => {
  const value = new Date(now);
  value.setDate(value.getDate() + 1);
  value.setSeconds(0, 0);

  // Start at the next whole hour for convenience. This is only an editable
  // default; users can enter any future date and time.
  value.setMinutes(0);
  value.setHours(value.getHours() + 1);

  return { date: formatLocalDateValue(value), time: formatLocalTimeValue(value) };
};

export type QuickMeetupTime = "TONIGHT" | "TOMORROW" | "WEEKEND";

export const createQuickMeetupDateTime = (
  option: QuickMeetupTime,
  now = new Date(),
): { date: string; time: string } => {
  const value = new Date(now);
  value.setSeconds(0, 0);
  if (option === "TONIGHT") {
    const tonight = new Date(value);
    tonight.setHours(19, 0, 0, 0);
    if (tonight.getTime() > now.getTime() + 30 * 60_000) value.setTime(tonight.getTime());
    else {
      value.setMinutes(value.getMinutes() < 30 ? 30 : 0);
      value.setHours(value.getHours() + (value.getMinutes() === 0 ? 2 : 1));
    }
  } else if (option === "TOMORROW") {
    value.setDate(value.getDate() + 1);
    value.setHours(18, 30, 0, 0);
  } else {
    const daysUntilSaturday = (6 - value.getDay() + 7) % 7 || 7;
    value.setDate(value.getDate() + daysUntilSaturday);
    value.setHours(16, 0, 0, 0);
  }
  return { date: formatLocalDateValue(value), time: formatLocalTimeValue(value) };
};

export const buildGoogleMapsSearchUrl = (query: string, locality: string): string => {
  const value = [query.trim(), locality.trim()].filter(Boolean).join(" in ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value || "cafes nearby")}`;
};

export const buildGoogleMapsPlaceUrl = (name: string, address: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [name.trim(), address.trim()].filter(Boolean).join(", "),
  )}`;

export const parseLocalDateTime = (
  dateInput: string,
  timeInput: string,
  now = new Date(),
): DateTimeInputResult => {
  const dateMatch = DATE_INPUT_PATTERN.exec(dateInput.trim());
  if (!dateMatch) {
    return { iso: null, error: "Enter the date as YYYY-MM-DD." };
  }

  const timeMatch = TIME_INPUT_PATTERN.exec(timeInput.trim());
  if (!timeMatch) {
    return { iso: null, error: "Enter the time in 24-hour format, such as 18:30." };
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (month < 1 || month > 12 || hour > 23 || minute > 59) {
    return { iso: null, error: "Choose a valid date and time." };
  }

  const value = new Date(year, month - 1, day, hour, minute, 0, 0);
  const isExactDate =
    value.getFullYear() === year &&
    value.getMonth() === month - 1 &&
    value.getDate() === day &&
    value.getHours() === hour &&
    value.getMinutes() === minute;

  if (!isExactDate) {
    return { iso: null, error: "Choose a valid date and time." };
  }

  if (value.getTime() <= now.getTime()) {
    return { iso: null, error: "Choose a date and time in the future." };
  }

  return { iso: value.toISOString(), error: null };
};

export const isSameMinute = (leftIso: string, rightIso: string): boolean => {
  const left = new Date(leftIso).getTime();
  const right = new Date(rightIso).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return Math.floor(left / 60_000) === Math.floor(right / 60_000);
};
