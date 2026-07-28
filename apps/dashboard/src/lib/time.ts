import { DateTime } from "luxon";

/** Interpret a datetime-local string (wall clock) in the given tz as a UTC Date. */
export function localInputToDate(input: string, tz: string): Date {
  const dt = DateTime.fromISO(input, { zone: tz });
  if (!dt.isValid) throw new Error(`Invalid date: ${input}`);
  return dt.toUTC().toJSDate();
}

/** Format a UTC Date as a datetime-local value in the given tz (for form inputs). */
export function dateToLocalInput(date: Date, tz: string): string {
  return DateTime.fromJSDate(date).setZone(tz).toFormat("yyyy-LL-dd'T'HH:mm");
}

/** Format a UTC Date as a date-only value (yyyy-mm-dd) in the given tz. */
export function dateToLocalDateInput(date: Date, tz: string): string {
  return DateTime.fromJSDate(date).setZone(tz).toFormat("yyyy-LL-dd");
}

/** Human-readable date in the given tz, e.g. "Wed, 30 Jul 2026, 14:30". */
export function formatInTz(date: Date, tz: string): string {
  return DateTime.fromJSDate(date)
    .setZone(tz)
    .toFormat("ccc, dd LLL yyyy, HH:mm");
}

/** Relative label such as "in 3 days" / "2 hours ago". */
export function relativeTo(date: Date): string {
  return DateTime.fromJSDate(date).toRelative() ?? "";
}
