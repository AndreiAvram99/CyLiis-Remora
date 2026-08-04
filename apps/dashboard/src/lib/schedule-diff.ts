import {
  durationLabel,
  RECURRENCE_LABELS,
  type RecurrenceName,
} from "@repo/shared";

export interface ScheduleSnapshot {
  title: string;
  description: string | null;
  kind: string;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  durationMinutes: number | null;
  location: string | null;
  url: string | null;
  channelId: string;
  recurrence: string;
}

/** Discord renders these in each reader's own timezone. */
function stamp(date: Date, allDay: boolean): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${allDay ? "D" : "F"}>`;
}

function same(a: string | null, b: string | null): boolean {
  return (a ?? "") === (b ?? "");
}

/**
 * What changed between two versions of a schedule, phrased for the Discord
 * update post. Empty when nothing worth announcing moved — saving an edit that
 * only touched reminders or attendees shouldn't ping the channel.
 */
export function describeScheduleChanges(
  before: ScheduleSnapshot,
  after: ScheduleSnapshot,
): string[] {
  const changes: string[] = [];

  if (before.title !== after.title) {
    changes.push(`Title → **${after.title}**`);
  }
  if (before.kind !== after.kind) {
    changes.push(`Type → **${after.kind.toLowerCase()}**`);
  }
  if (before.startAt.getTime() !== after.startAt.getTime()) {
    changes.push(`Starts → ${stamp(after.startAt, after.allDay)}`);
  }

  // Events span whole days and carry an end date; meetings carry a duration.
  if (after.allDay) {
    const wasEnd = before.endAt?.getTime() ?? 0;
    if (after.endAt && wasEnd !== after.endAt.getTime()) {
      changes.push(`Ends → ${stamp(after.endAt, true)}`);
    }
  } else if (
    after.durationMinutes &&
    before.durationMinutes !== after.durationMinutes
  ) {
    changes.push(`Duration → **${durationLabel(after.durationMinutes)}**`);
  }

  if (!same(before.location, after.location)) {
    changes.push(
      after.location ? `Location → **${after.location}**` : "Location removed",
    );
  }
  if (!same(before.url, after.url)) {
    changes.push(after.url ? `Link → ${after.url}` : "Link removed");
  }
  if (!same(before.description, after.description)) {
    changes.push(
      after.description ? "Description updated" : "Description removed",
    );
  }
  if (before.channelId !== after.channelId) {
    changes.push(`Channel → <#${after.channelId}>`);
  }
  if (before.recurrence !== after.recurrence) {
    const label =
      RECURRENCE_LABELS[after.recurrence as RecurrenceName] ?? after.recurrence;
    changes.push(`Repeats → **${label}**`);
  }

  return changes;
}
