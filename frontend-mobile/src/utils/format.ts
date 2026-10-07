// Formatting helpers for dates, distances, durations, etc.

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 30) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  const min = Math.floor(diff / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}w ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatTimeOfDay(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Time to be decided";
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "Time to be decided";
  return value.toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDistance(km: number, hidden = false): string {
  if (hidden) return "Distance hidden";
  if (km < 1) return "<1 km";
  return `${Math.round(km)} km away`;
}

export function formatDurationSec(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export function ageFromIso(iso: string | null): number | null {
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function humanizeProfileValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const machine = value.includes("_") || /[a-z\d][A-Z]/.test(value) || value === value.toUpperCase();
  const spaced = value.replace(/([a-z\d])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  return (machine ? spaced.toLowerCase() : spaced).replace(/^./, letter => letter.toUpperCase());
}

export function formatDateInput(year: string, month: string, day: string): string | null {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (!y || !m || !d) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const iso = `${y.toString().padStart(4, "0")}-${pad2(m)}-${pad2(d)}T00:00:00.000Z`;
  if (Number.isNaN(new Date(iso).getTime())) return null;
  return iso;
}
