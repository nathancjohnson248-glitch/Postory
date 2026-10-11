/**
 * Timezone helpers built on Intl (no dependencies). Timestamps are stored in
 * UTC; everything the user sees is rendered in their profile timezone.
 * Isomorphic — used by server pages and client components.
 */

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

export function safeTimeZone(tz: string | null | undefined) {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function zonedParts(date: Date, timeZone: string): Parts {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAYS[out.weekday] ?? 0,
  };
}

/** Offset of `timeZone` from UTC at `date`, in minutes (e.g. -240 for New York in summer). */
export function timeZoneOffsetMinutes(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Convert a wall-clock date + time in `timeZone` to the UTC instant. DST-safe. */
export function zonedToUtc(dateKey: string, time: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let offset = timeZoneOffsetMinutes(new Date(guess), timeZone);
  let result = guess - offset * 60000;
  const second = timeZoneOffsetMinutes(new Date(result), timeZone);
  if (second !== offset) {
    offset = second;
    result = guess - offset * 60000;
  }
  return new Date(result);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD of `date` in `timeZone`. */
export function dateKey(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** HH:mm of `date` in `timeZone`. */
export function timeKey(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function addDaysToKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** ISO string with explicit offset for an instant in `timeZone` (for datetime inputs → server). */
export function toZonedIso(date: Date, timeZone: string) {
  const offset = timeZoneOffsetMinutes(date, timeZone);
  const local = new Date(date.getTime() + offset * 60000);
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${local.toISOString().slice(0, 19)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function formatInZone(date: Date | string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(d);
}

export function formatTime(date: Date | string, timeZone: string) {
  return formatInZone(date, timeZone, { hour: "numeric", minute: "2-digit" });
}

/** "Today, 9:04 AM" / "Tomorrow, 8:30 AM" / "Thu, Oct 16, 9:00 AM" */
export function formatRelativeDay(date: Date | string, timeZone: string, now = new Date()) {
  const d = typeof date === "string" ? new Date(date) : date;
  const key = dateKey(d, timeZone);
  const today = dateKey(now, timeZone);
  const time = formatTime(d, timeZone);
  if (key === today) return `Today, ${time}`;
  if (key === addDaysToKey(today, 1)) return `Tomorrow, ${time}`;
  if (key === addDaysToKey(today, -1)) return `Yesterday, ${time}`;
  return `${formatInZone(d, timeZone, { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
}

export function greeting(timeZone: string, now = new Date()) {
  const hour = zonedParts(now, timeZone).hour;
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Month grid (6 weeks, Monday-first) for a "YYYY-MM" key. */
export function monthGrid(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const start = `${y}-${pad(m)}-01`;
  const days: { key: string; inMonth: boolean; day: number }[] = [];
  for (let i = -lead; i < 42 - lead; i++) {
    const key = addDaysToKey(start, i);
    const [, mm, dd] = key.split("-").map(Number);
    days.push({ key, inMonth: mm === m, day: dd });
  }
  return days;
}

export function shiftMonth(monthKey: string, delta: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`;
}

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
