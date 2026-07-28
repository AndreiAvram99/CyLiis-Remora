export type ReminderUnit = "minutes" | "hours" | "days";

export const UNIT_MINUTES: Record<ReminderUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
};

/** Convert a {value, unit} lead time into total minutes. */
export function toOffsetMinutes(value: number, unit: ReminderUnit): number {
  return Math.round(value * UNIT_MINUTES[unit]);
}

/** Convert stored offset minutes back into the largest whole {value, unit}. */
export function fromOffsetMinutes(offsetMinutes: number): {
  value: number;
  unit: ReminderUnit;
} {
  if (offsetMinutes <= 0) return { value: 0, unit: "minutes" };
  if (offsetMinutes % UNIT_MINUTES.days === 0) {
    return { value: offsetMinutes / UNIT_MINUTES.days, unit: "days" };
  }
  if (offsetMinutes % UNIT_MINUTES.hours === 0) {
    return { value: offsetMinutes / UNIT_MINUTES.hours, unit: "hours" };
  }
  return { value: offsetMinutes, unit: "minutes" };
}

/** Human friendly label such as "1 day before" / "15 minutes before". */
export function offsetLabel(offsetMinutes: number): string {
  if (offsetMinutes <= 0) return "at start time";
  const { value, unit } = fromOffsetMinutes(offsetMinutes);
  const singular = unit.slice(0, -1); // minutes -> minute
  const word = value === 1 ? singular : unit;
  return `${value} ${word} before`;
}

/** Compute the absolute due time for a reminder. */
export function computeDueAt(startAt: Date, offsetMinutes: number): Date {
  return new Date(startAt.getTime() - offsetMinutes * 60_000);
}

export const EVENT_KINDS = ["MEETING", "EVENT", "CUSTOM"] as const;
export type EventKindName = (typeof EVENT_KINDS)[number];

export const RECURRENCES = ["NONE", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export type RecurrenceName = (typeof RECURRENCES)[number];

export const RECURRENCE_LABELS: Record<RecurrenceName, string> = {
  NONE: "Does not repeat",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

/** Short label for lists/badges, e.g. "Repeats weekly". */
export function recurrenceBadge(rec: string): string | null {
  switch (rec) {
    case "WEEKLY":
      return "Repeats weekly";
    case "MONTHLY":
      return "Repeats monthly";
    case "YEARLY":
      return "Repeats yearly";
    default:
      return null;
  }
}

/** Common meeting durations offered in the form (minutes). */
export const MEETING_DURATIONS: { minutes: number; label: string }[] = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 45, label: "45 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 90, label: "1 hour 30 min" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
];

/** Human label for an arbitrary duration in minutes, e.g. "1h 30m". */
export function durationLabel(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// Only two RSVP states: you're coming, or you owe a motivation for missing it.
// ("NO" still exists in the DB enum for old rows but is no longer offered.)
export const RSVP_STATUSES = ["GOING", "MOTIVATED"] as const;
export type RsvpStatusName = (typeof RSVP_STATUSES)[number];

/** Human-readable labels for each RSVP status. */
export const RSVP_LABELS: Record<RsvpStatusName, string> = {
  GOING: "Going",
  MOTIVATED: "Motivation",
};

/** Discord button custom IDs for RSVP, encoded as rsvp:<eventId>:<status>. */
export function rsvpButtonId(eventId: string, status: RsvpStatusName): string {
  return `rsvp:${eventId}:${status}`;
}

export function parseRsvpButtonId(
  customId: string,
): { eventId: string; status: RsvpStatusName } | null {
  const parts = customId.split(":");
  if (parts.length !== 3 || parts[0] !== "rsvp") return null;
  const status = parts[2] as RsvpStatusName;
  if (!RSVP_STATUSES.includes(status)) return null;
  return { eventId: parts[1], status };
}

/**
 * Custom ID for the "Motivation" reason modal, encoded as motiv:<eventId>.
 * The text input inside the modal always uses the id below.
 */
export const MOTIVATION_INPUT_ID = "reason";

export function motivationModalId(eventId: string): string {
  return `motiv:${eventId}`;
}

export function parseMotivationModalId(customId: string): string | null {
  const parts = customId.split(":");
  if (parts.length !== 2 || parts[0] !== "motiv") return null;
  return parts[1];
}

/**
 * Custom ID for the print-request claim button, encoded as print:<eventId>:claim.
 * Tapping it toggles who's taking care of printing the attached file(s).
 */
export function printClaimButtonId(eventId: string): string {
  return `print:${eventId}:claim`;
}

export function parsePrintButtonId(customId: string): string | null {
  const parts = customId.split(":");
  if (parts.length !== 3 || parts[0] !== "print" || parts[2] !== "claim") {
    return null;
  }
  return parts[1];
}

export const PRINT_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type PrintPriority = (typeof PRINT_PRIORITIES)[number];

export const PRINT_PRIORITY_LABELS: Record<PrintPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PRINT_PRIORITY_EMOJI: Record<PrintPriority, string> = {
  LOW: "⚪",
  NORMAL: "🔵",
  HIGH: "🟠",
  URGENT: "🔴",
};

/** Higher = more important; used for sorting the print queue. */
export const PRINT_PRIORITY_WEIGHT: Record<PrintPriority, number> = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3,
};

export const PRINT_STATUSES = ["PENDING", "PRINTING", "DONE"] as const;
export type PrintStatus = (typeof PRINT_STATUSES)[number];

export const PRINT_STATUS_LABELS: Record<PrintStatus, string> = {
  PENDING: "Pending",
  PRINTING: "Printing",
  DONE: "Done",
};

export const PRINT_STATUS_EMOJI: Record<PrintStatus, string> = {
  PENDING: "🕓",
  PRINTING: "🖨️",
  DONE: "✅",
};

function asPriority(value?: string | null): PrintPriority {
  return PRINT_PRIORITIES.includes(value as PrintPriority)
    ? (value as PrintPriority)
    : "NORMAL";
}

function asStatus(value?: string | null): PrintStatus {
  return PRINT_STATUSES.includes(value as PrintStatus)
    ? (value as PrintStatus)
    : "PENDING";
}

export interface PrintFileLine {
  name: string;
  priority?: string | null;
  order?: number | null;
  copies?: number | null;
}

/** Sort files by print order (0/unset last), then by importance descending. */
export function sortPrintFiles<T extends PrintFileLine>(files: T[]): T[] {
  return [...files].sort((a, b) => {
    const ao = a.order && a.order > 0 ? a.order : Number.MAX_SAFE_INTEGER;
    const bo = b.order && b.order > 0 ? b.order : Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return (
      PRINT_PRIORITY_WEIGHT[asPriority(b.priority)] -
      PRINT_PRIORITY_WEIGHT[asPriority(a.priority)]
    );
  });
}

export interface PrintMessageParams {
  eventId: string;
  files: PrintFileLine[];
  description?: string | null;
  requesterName?: string | null;
  claimedByName?: string | null;
  status?: string | null;
}

/**
 * The Discord message payload (plain API JSON) for a print request. Shared so
 * the dashboard can post it (via REST with the file attached) and the worker
 * can rebuild it when the claim state changes — keeping both in sync.
 */
export function buildPrintMessagePayload(p: PrintMessageParams) {
  const status = asStatus(p.status);

  // Files listed in print order with their importance, so whoever prints them
  // knows what comes first and what's urgent.
  const fileLines = sortPrintFiles(p.files).map((f) => {
    const pr = asPriority(f.priority);
    const qty =
      f.copies && f.copies > 1 ? ` — \`🖨️ ×${f.copies} copies\`` : "";
    return `${PRINT_PRIORITY_EMOJI[pr]} ${f.name}${qty}`;
  });

  const description = [p.description?.trim(), fileLines.join("\n")]
    .filter(Boolean)
    .join("\n\n");

  const fields: { name: string; value: string; inline?: boolean }[] = [];
  if (p.requesterName) {
    fields.push({ name: "Requested by", value: p.requesterName, inline: true });
  }
  fields.push({
    name: "Status",
    value: `${PRINT_STATUS_EMOJI[status]} ${PRINT_STATUS_LABELS[status]}`,
    inline: true,
  });
  fields.push({
    name: "\u200b",
    value: p.claimedByName
      ? `✅ **${p.claimedByName}** is taking care of it`
      : "🖐️ Up for grabs — tap below if you'll print it",
  });

  return {
    embeds: [
      {
        title: "🖨️ Print request",
        description: description || undefined,
        color: 0x209ebb,
        fields,
        footer: { text: "Attached file(s) need printing" },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: p.claimedByName ? 3 : 1,
            label: p.claimedByName
              ? "I've got it — tap to release"
              : "I'll take care of it",
            custom_id: printClaimButtonId(p.eventId),
            emoji: { name: p.claimedByName ? "✅" : "🖨️" },
          },
        ],
      },
    ],
  };
}
