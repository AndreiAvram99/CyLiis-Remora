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

/**
 * Google Calendar's API only supports its fixed event-color palette, not
 * arbitrary hex colors. Return the closest supported color id for a channel
 * color so Google events visually match the dashboard as closely as possible.
 */
const GOOGLE_EVENT_COLORS = [
  { id: "1", hex: "#7986CB" }, // lavender
  { id: "2", hex: "#33B679" }, // sage
  { id: "3", hex: "#8E24AA" }, // grape
  { id: "4", hex: "#E67C73" }, // flamingo
  { id: "5", hex: "#F6C026" }, // banana
  { id: "6", hex: "#F5511D" }, // tangerine
  { id: "7", hex: "#039BE5" }, // peacock
  { id: "8", hex: "#616161" }, // graphite
  { id: "9", hex: "#3F51B5" }, // blueberry
  { id: "10", hex: "#0B8043" }, // basil
  { id: "11", hex: "#D60000" }, // tomato
] as const;

function rgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

export function googleEventColorId(hex?: string | null): string | undefined {
  const target = hex ? rgb(hex) : null;
  if (!target) return undefined;

  let closest: string = GOOGLE_EVENT_COLORS[0].id;
  let best = Number.POSITIVE_INFINITY;
  for (const candidate of GOOGLE_EVENT_COLORS) {
    const value = rgb(candidate.hex);
    if (!value) continue;
    const distance =
      (target[0] - value[0]) ** 2 +
      (target[1] - value[1]) ** 2 +
      (target[2] - value[2]) ** 2;
    if (distance < best) {
      best = distance;
      closest = candidate.id;
    }
  }
  return closest;
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

/**
 * Channels that only take print requests, matched by lowercase Discord name.
 * Meetings and events can't be scheduled into them.
 */
export const PRINT_ONLY_CHANNELS = ["printing"];

export interface Mentions {
  roleIds?: string[];
  userIds?: string[];
  everyone?: boolean;
}

/** The ping line that opens an announcement, or "" when nothing was chosen. */
export function mentionPrefix(m: Mentions): string {
  const parts = [
    ...(m.everyone ? ["@everyone"] : []),
    ...(m.roleIds ?? []).map((id) => `<@&${id}>`),
    ...(m.userIds ?? []).map((id) => `<@${id}>`),
  ];
  return parts.join(" ");
}

/**
 * Discord only rings the people listed here, whatever the message body says. So
 * a title or description containing "@everyone" can't ping the server, while
 * the tags actually picked for the schedule still do.
 */
export function allowedMentionsFor(m: Mentions): {
  parse: ("everyone" | "roles" | "users")[];
  roles: string[];
  users: string[];
} {
  return {
    parse: m.everyone ? ["everyone"] : [],
    roles: (m.roleIds ?? []).slice(0, 100),
    users: (m.userIds ?? []).slice(0, 100),
  };
}

/**
 * Custom ID for the "Mark as read" button on a forwarded Instagram DM. Keyed by
 * our own row id rather than Instagram's `mid`, which routinely exceeds
 * Discord's 100-character limit for custom ids.
 */
const IG_READ_PREFIX = "igread:";

export function instagramReadButtonId(id: string): string {
  return `${IG_READ_PREFIX}${id}`;
}

export function parseInstagramReadButtonId(customId: string): string | null {
  if (!customId.startsWith(IG_READ_PREFIX)) return null;
  return customId.slice(IG_READ_PREFIX.length) || null;
}

export interface InstagramMessageParams {
  id: string;
  author: string;
  authorIcon?: string | null;
  text?: string | null;
  imageUrl?: string | null;
  attachments?: string[];
  sentAt: Date;
  readByName?: string | null;
  readAt?: Date | null;
}

const INSTAGRAM_PINK = 0xe1306c;
const INSTAGRAM_READ = 0x4b5563;

/**
 * The Discord payload for a forwarded Instagram DM. Shared so the dashboard can
 * post it from the webhook and the worker can rebuild it once someone marks the
 * message as read.
 */
export function buildInstagramMessagePayload(p: InstagramMessageParams) {
  const read = Boolean(p.readByName);

  const fields: { name: string; value: string; inline?: boolean }[] = [];
  if (p.attachments?.length) {
    fields.push({
      name: "Attachments",
      value: p.attachments.join("\n").slice(0, 1000),
    });
  }
  fields.push({
    name: "\u200b",
    value: read
      ? `👀 Read by **${p.readByName}**`
      : "🔴 Nobody has picked this up yet",
  });

  return {
    embeds: [
      {
        title: "📩 Instagram DM",
        author: {
          name: p.author,
          icon_url: p.authorIcon ?? undefined,
        },
        description: p.text?.trim()?.slice(0, 4000) || "(no text)",
        color: read ? INSTAGRAM_READ : INSTAGRAM_PINK,
        image: p.imageUrl ? { url: p.imageUrl } : undefined,
        fields,
        timestamp: p.sentAt.toISOString(),
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: read ? 2 : 1,
            label: read ? `Read by ${p.readByName}` : "Mark as read",
            custom_id: instagramReadButtonId(p.id),
            emoji: { name: "👀" },
            disabled: read,
          },
        ],
      },
    ],
    // A DM containing "@everyone" must never ping the server.
    allowed_mentions: { parse: [] as string[] },
  };
}

/** Filament materials offered per print file. */
export const FILAMENT_TYPES = [
  "PLA",
  "PETG",
  "ASA/ABS",
  "TPU",
  "PC",
  "PA/PET",
  "PPS",
  "Support",
  "Fiber Reinforced",
] as const;
export type FilamentType = (typeof FILAMENT_TYPES)[number];

export const DEFAULT_FILAMENT: FilamentType = "PLA";
export const DEFAULT_INFILL = 60;
export const DEFAULT_WALL_COUNT = 4;
export const DEFAULT_PRINT_COLOR = "#132884";

/** Swatch palette for choosing a print color. */
export const PRINT_COLORS: string[] = [
  "#FFFFFF", // white
  "#000000", // black
  "#A54433", // red
  "#132884", // blue
  "#618B53", // green
];

/** Name + circle emoji for each palette color, for human-readable labels. */
export const PRINT_COLOR_META: Record<string, { name: string; dot: string }> = {
  "#FFFFFF": { name: "White", dot: "⚪" },
  "#000000": { name: "Black", dot: "⚫" },
  "#A54433": { name: "Red", dot: "🔴" },
  "#132884": { name: "Blue", dot: "🔵" },
  "#618B53": { name: "Green", dot: "🟢" },
};

export function printColorMeta(hex?: string | null): { name: string; dot: string } {
  const key = (hex ?? "").toUpperCase();
  return PRINT_COLOR_META[key] ?? { name: hex ?? "Custom", dot: "🎨" };
}

function asFilament(value?: string | null): FilamentType {
  return FILAMENT_TYPES.includes(value as FilamentType)
    ? (value as FilamentType)
    : DEFAULT_FILAMENT;
}

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

function asStatus(value?: string | null): PrintStatus {
  return PRINT_STATUSES.includes(value as PrintStatus)
    ? (value as PrintStatus)
    : "PENDING";
}

export interface PrintFileLine {
  name: string;
  order?: number | null;
  copies?: number | null;
  filamentType?: string | null;
  infill?: number | null;
  color?: string | null;
  wallCount?: number | null;
  needsSupport?: boolean | null;
}

/** Sort files by print order (0/unset last), preserving list order otherwise. */
export function sortPrintFiles<T extends PrintFileLine>(files: T[]): T[] {
  return [...files].sort((a, b) => {
    const ao = a.order && a.order > 0 ? a.order : Number.MAX_SAFE_INTEGER;
    const bo = b.order && b.order > 0 ? b.order : Number.MAX_SAFE_INTEGER;
    return ao - bo;
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

  // One roomy block per file, listed in print order, so whoever prints them can
  // scan the color at a glance and read the slice settings clearly.
  const fileBlocks = sortPrintFiles(p.files).map((f) => {
    const color = printColorMeta(f.color ?? DEFAULT_PRINT_COLOR);
    const qty = `  ·  ×${f.copies ?? 1}`;
    const specs = [
      asFilament(f.filamentType),
      `${f.infill ?? DEFAULT_INFILL}% infill`,
      `${f.wallCount ?? DEFAULT_WALL_COUNT} walls`,
    ];
    if (f.needsSupport) specs.push("needs support");
    specs.push(color.name);
    return `${color.dot} **${f.name}**${qty}\n　${specs.join(" · ")}`;
  });

  const description = [p.description?.trim(), fileBlocks.join("\n\n")]
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
  const done = status === "DONE";
  const claimed = !!p.claimedByName;
  fields.push({
    name: "\u200b",
    value: done
      ? `✅ **${p.claimedByName ?? "Someone"}** finished printing it`
      : claimed
        ? `🖨️ **${p.claimedByName}** is printing it`
        : "🖐️ Up for grabs — tap below if you'll print it",
  });

  // Two-tap flow: claim (→ Printing) then confirm done (→ Done).
  const button = done
    ? {
        type: 2,
        style: 3,
        label: "Printed",
        custom_id: printClaimButtonId(p.eventId),
        emoji: { name: "✅" },
        disabled: true,
      }
    : claimed
      ? {
          type: 2,
          style: 3,
          label: "Mark as printed",
          custom_id: printClaimButtonId(p.eventId),
          emoji: { name: "✅" },
        }
      : {
          type: 2,
          style: 1,
          label: "I'll take care of it",
          custom_id: printClaimButtonId(p.eventId),
          emoji: { name: "🖨️" },
        };

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
        components: [button],
      },
    ],
  };
}
