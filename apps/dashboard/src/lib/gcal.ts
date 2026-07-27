import { readFileSync } from "node:fs";
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

/** A normalized calendar entry pulled from Google, for display in the app. */
export interface CalendarItem {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date | null;
  allDay: boolean;
  htmlLink: string | null;
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

function toCalendarItem(e: calendar_v3.Schema$Event): CalendarItem | null {
  const startRaw = e.start?.dateTime ?? e.start?.date;
  if (!startRaw || !e.id) return null;
  const allDay = !e.start?.dateTime;
  const endRaw = e.end?.dateTime ?? e.end?.date ?? null;
  return {
    id: e.id,
    title: e.summary?.trim() || "(no title)",
    description: e.description ?? null,
    location: e.location ?? null,
    start: new Date(startRaw),
    end: endRaw ? new Date(endRaw) : null,
    allDay,
    htmlLink: e.htmlLink ?? null,
  };
}

/**
 * Pull upcoming events from the connected Google Calendar so they can be
 * shown directly in the app. Returns an empty list if calendar sync is off
 * or the request fails (never throws).
 */
export async function listCalendarEvents(options?: {
  timeMin?: Date;
  timeMax?: Date;
  maxResults?: number;
}): Promise<CalendarItem[]> {
  const cal = getCalendar();
  if (!cal) return [];
  const timeMin = options?.timeMin ?? new Date();
  const timeMax =
    options?.timeMax ??
    new Date(timeMin.getTime() + 90 * 24 * 60 * 60 * 1000);
  try {
    const res = await cal.events.list({
      calendarId: env.googleCalendarId(),
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: options?.maxResults ?? 50,
    });
    return (res.data.items ?? [])
      .map(toCalendarItem)
      .filter((i): i is CalendarItem => i !== null);
  } catch (err) {
    console.error("[gcal] list failed:", err);
    return [];
  }
}

export function isCalendarEnabled(): boolean {
  return getCalendar() !== null;
}
