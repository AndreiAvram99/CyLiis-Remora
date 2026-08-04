import { readFileSync } from "node:fs";
import { DateTime } from "luxon";
import { google, type calendar_v3 } from "googleapis";
import { googleEventColorId } from "@repo/shared";
import { env } from "./env";

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  startAt: Date;
  endAt?: Date | null;
  allDay?: boolean; // date-only event (no time of day)
  timezone: string;
  recurrence?: string | null;
  color?: string | null;
}

let cached: calendar_v3.Calendar | null | undefined;

/** Resolve the raw service-account JSON from either the inline env or a file. */
function readServiceAccountJson(): string | null {
  const inline = env.googleServiceAccountJson();
  if (inline) {
    return inline.trim().startsWith("{")
      ? inline
      : Buffer.from(inline, "base64").toString("utf8");
  }
  const file = env.googleServiceAccountFile();
  if (file) {
    try {
      return readFileSync(file, "utf8");
    } catch (err) {
      console.error("[gcal] Failed to read service account file:", err);
      return null;
    }
  }
  return null;
}

function getCalendar(): calendar_v3.Calendar | null {
  if (cached !== undefined) return cached;

  if (!env.googleCalendarEnabled()) {
    cached = null;
    return cached;
  }
  const json = readServiceAccountJson();
  if (!json) {
    cached = null;
    return cached;
  }

  try {
    const creds = JSON.parse(json) as {
      client_email: string;
      private_key: string;
    };
    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    cached = google.calendar({ version: "v3", auth });
  } catch (err) {
    console.error("[gcal] Failed to init Google Calendar client:", err);
    cached = null;
  }
  return cached;
}

/**
 * The calendar an event of the given kind should be pushed to. Uses the
 * per-kind override when set, otherwise the shared GOOGLE_CALENDAR_ID.
 */
export function calendarIdForKind(kind: string): string {
  const perKind: Record<string, string> = {
    MEETING: env.googleCalendarIdMeeting(),
    EVENT: env.googleCalendarIdEvent(),
    CUSTOM: env.googleCalendarIdCustom(),
  };
  return perKind[kind] || env.googleCalendarId();
}

function toResource(input: CalendarEventInput): calendar_v3.Schema$Event {
  const descriptionParts = [input.description ?? ""];
  if (input.url) descriptionParts.push(`\nLink: ${input.url}`);
  const frequency = ["WEEKLY", "MONTHLY", "YEARLY"].includes(
    input.recurrence ?? "",
  )
    ? input.recurrence
    : null;
  const base = {
    summary: input.title,
    description: descriptionParts.join("").trim() || undefined,
    location: input.location ?? undefined,
    colorId: googleEventColorId(input.color),
    // No UNTIL/COUNT: Remora recurrence continues until the schedule is deleted.
    recurrence: frequency ? [`RRULE:FREQ=${frequency}`] : undefined,
  };

  if (input.allDay) {
    // Google all-day events use `date` with an EXCLUSIVE end (day after).
    const startDate = DateTime.fromJSDate(input.startAt).setZone(
      input.timezone,
    );
    const endSource = input.endAt ?? input.startAt;
    const endDate = DateTime.fromJSDate(endSource)
      .setZone(input.timezone)
      .plus({ days: 1 });
    return {
      ...base,
      start: { date: startDate.toFormat("yyyy-LL-dd") },
      end: { date: endDate.toFormat("yyyy-LL-dd") },
    };
  }

  const end = input.endAt ?? new Date(input.startAt.getTime() + 60 * 60 * 1000);
  return {
    ...base,
    start: { dateTime: input.startAt.toISOString(), timeZone: input.timezone },
    end: { dateTime: end.toISOString(), timeZone: input.timezone },
  };
}

/**
 * Create a calendar event in the given calendar (defaults to GOOGLE_CALENDAR_ID).
 * Returns the Google event id, or null on failure.
 */
export async function createCalendarEvent(
  input: CalendarEventInput,
  calendarId: string = env.googleCalendarId(),
): Promise<string | null> {
  const cal = getCalendar();
  if (!cal) return null;
  try {
    const res = await cal.events.insert({
      calendarId,
      requestBody: toResource(input),
    });
    return res.data.id ?? null;
  } catch (err) {
    console.error("[gcal] create failed:", err);
    return null;
  }
}

/** Update a calendar event in a specific calendar. Returns true on success. */
export async function updateCalendarEvent(
  calendarId: string,
  eventId: string,
  input: CalendarEventInput,
): Promise<boolean> {
  const cal = getCalendar();
  if (!cal) return false;
  try {
    await cal.events.update({
      calendarId,
      eventId,
      requestBody: toResource(input),
    });
    return true;
  } catch (err) {
    console.error("[gcal] update failed:", err);
    return false;
  }
}

/** Update only an event's Google palette color, preserving all other fields. */
export async function updateCalendarEventColor(
  calendarId: string,
  eventId: string,
  color: string,
): Promise<boolean> {
  const cal = getCalendar();
  if (!cal) return false;
  const colorId = googleEventColorId(color);
  if (!colorId) return false;
  try {
    await cal.events.patch({
      calendarId,
      eventId,
      requestBody: { colorId },
    });
    return true;
  } catch (err) {
    console.error("[gcal] color update failed:", err);
    return false;
  }
}

/** Delete a calendar event from a specific calendar. Swallows 404/410. */
export async function deleteCalendarEvent(
  calendarId: string,
  eventId: string,
): Promise<void> {
  const cal = getCalendar();
  if (!cal) return;
  try {
    await cal.events.delete({ calendarId, eventId });
  } catch (err) {
    console.error("[gcal] delete failed (ignored):", err);
  }
}

/** Whether the app can push to Google Calendar at all. */
export function isCalendarEnabled(): boolean {
  return getCalendar() !== null;
}
