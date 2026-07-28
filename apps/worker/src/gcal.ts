import { readFileSync } from "node:fs";
import { DateTime } from "luxon";
import { google, type calendar_v3 } from "googleapis";
import { env } from "./env.js";

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  startAt: Date;
  endAt?: Date | null;
  allDay?: boolean;
  timezone: string;
}

let cached: calendar_v3.Calendar | null | undefined;

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

/** Calendar an event of the given kind belongs to (per-kind or the default). */
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
  const base = {
    summary: input.title,
    description: descriptionParts.join("").trim() || undefined,
    location: input.location ?? undefined,
  };

  if (input.allDay) {
    const startDate = DateTime.fromJSDate(input.startAt).setZone(input.timezone);
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

/** Create a calendar event. Returns the Google event id, or null on failure. */
export async function createCalendarEvent(
  input: CalendarEventInput,
  calendarId: string,
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
