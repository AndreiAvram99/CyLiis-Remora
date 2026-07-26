import { google, type calendar_v3 } from "googleapis";
import { env } from "./env";

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  startAt: Date;
  endAt?: Date | null;
  timezone: string;
}

let cached: calendar_v3.Calendar | null | undefined;

function getCalendar(): calendar_v3.Calendar | null {
  if (cached !== undefined) return cached;

  if (!env.googleCalendarEnabled()) {
    cached = null;
    return cached;
  }
  const raw = env.googleServiceAccountJson();
  if (!raw) {
    cached = null;
    return cached;
  }

  try {
    const json = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
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

function toResource(input: CalendarEventInput): calendar_v3.Schema$Event {
  const end = input.endAt ?? new Date(input.startAt.getTime() + 60 * 60 * 1000);
  const descriptionParts = [input.description ?? ""];
  if (input.url) descriptionParts.push(`\nLink: ${input.url}`);
  return {
    summary: input.title,
    description: descriptionParts.join("").trim() || undefined,
    location: input.location ?? undefined,
    start: { dateTime: input.startAt.toISOString(), timeZone: input.timezone },
    end: { dateTime: end.toISOString(), timeZone: input.timezone },
  };
}

/** Create a calendar event. Returns the Google event id, or null on failure. */
export async function createCalendarEvent(
  input: CalendarEventInput,
): Promise<string | null> {
  const cal = getCalendar();
  if (!cal) return null;
  try {
    const res = await cal.events.insert({
      calendarId: env.googleCalendarId(),
      requestBody: toResource(input),
    });
    return res.data.id ?? null;
  } catch (err) {
    console.error("[gcal] create failed:", err);
    return null;
  }
}

/** Update a calendar event. Returns true on success. */
export async function updateCalendarEvent(
  eventId: string,
  input: CalendarEventInput,
): Promise<boolean> {
  const cal = getCalendar();
  if (!cal) return false;
  try {
    await cal.events.update({
      calendarId: env.googleCalendarId(),
      eventId,
      requestBody: toResource(input),
    });
    return true;
  } catch (err) {
    console.error("[gcal] update failed:", err);
    return false;
  }
}

/** Delete a calendar event. Swallows 404/410 (already gone). */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const cal = getCalendar();
  if (!cal) return;
  try {
    await cal.events.delete({
      calendarId: env.googleCalendarId(),
      eventId,
    });
  } catch (err) {
    console.error("[gcal] delete failed (ignored):", err);
  }
}

export function isCalendarEnabled(): boolean {
  return getCalendar() !== null;
}
