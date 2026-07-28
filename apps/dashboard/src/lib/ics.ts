import { createHash } from "node:crypto";

/**
 * A stable, unguessable token for the public calendar feed URL. Derived from
 * NEXTAUTH_SECRET so it needs no extra config and stays constant across
 * deploys (like a Google "secret iCal address"). Anyone with the link can
 * subscribe, so we keep it out of the way but don't require a login — calendar
 * apps can't send session cookies.
 */
export function calendarFeedToken(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.DISCORD_CLIENT_SECRET || "";
  return createHash("sha256")
    .update(`calendar-feed:${secret}`)
    .digest("hex")
    .slice(0, 32);
}

export interface IcsEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  startAt: Date;
  endAt?: Date | null;
  allDay: boolean;
  durationMinutes?: number | null;
  updatedAt: Date;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC timestamp: 20260130T140000Z */
function toUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Date-only value for all-day events: 20260130 */
function toDateValue(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** Escape per RFC 5545: backslash, comma, semicolon, newline. */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold long lines to 75 octets as recommended by RFC 5545. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

function vevent(e: IcsEvent, domain: string): string {
  const lines: string[] = ["BEGIN:VEVENT", `UID:${e.id}@${domain}`];
  lines.push(`DTSTAMP:${toUtcStamp(e.updatedAt)}`);

  if (e.allDay) {
    const end = e.endAt ?? e.startAt;
    // DTEND is exclusive for all-day events, so add a day.
    const endExclusive = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    lines.push(`DTSTART;VALUE=DATE:${toDateValue(e.startAt)}`);
    lines.push(`DTEND;VALUE=DATE:${toDateValue(endExclusive)}`);
  } else {
    const end =
      e.endAt ??
      (e.durationMinutes
        ? new Date(e.startAt.getTime() + e.durationMinutes * 60 * 1000)
        : new Date(e.startAt.getTime() + 60 * 60 * 1000));
    lines.push(`DTSTART:${toUtcStamp(e.startAt)}`);
    lines.push(`DTEND:${toUtcStamp(end)}`);
  }

  lines.push(`SUMMARY:${esc(e.title)}`);
  const desc = [e.description?.trim(), e.url?.trim()].filter(Boolean).join("\n\n");
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
  if (e.location?.trim()) lines.push(`LOCATION:${esc(e.location.trim())}`);
  if (e.url?.trim()) lines.push(`URL:${esc(e.url.trim())}`);
  lines.push("END:VEVENT");
  return lines.map(fold).join("\r\n");
}

/** Build a full VCALENDAR document from the given events. */
export function buildIcs(
  events: IcsEvent[],
  opts: { name: string; domain: string },
): string {
  const head = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CyLiis Remora//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(opts.name)}`,
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  const body = events.map((e) => vevent(e, opts.domain));
  return [...head, ...body, "END:VCALENDAR"].join("\r\n") + "\r\n";
}
