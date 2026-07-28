import { DateTime } from "luxon";
import { prisma, ReminderStatus, type Prisma } from "@repo/db";
import { computeDueAt, offsetLabel } from "@repo/shared";
import { calendarIdForKind, createCalendarEvent } from "./gcal.js";

function addRecurrence(dt: DateTime, rec: string): DateTime<boolean> {
  switch (rec) {
    case "WEEKLY":
      return dt.plus({ weeks: 1 });
    case "MONTHLY":
      return dt.plus({ months: 1 });
    case "YEARLY":
      return dt.plus({ years: 1 });
    default:
      return dt;
  }
}

type OccWithReminders = Prisma.EventGetPayload<{ include: { reminders: true } }>;

/**
 * Keep exactly one upcoming occurrence materialized for each active recurring
 * series. Once the latest occurrence's start passes, spawn the next one (a new
 * Event row with fresh reminders/announcement/RSVP), leaving the past
 * occurrence — and its attendance — untouched.
 */
export async function advanceRecurringSeries(guildId: string, tz: string) {
  const recs = await prisma.event.findMany({
    where: { guildId, recurrence: { not: "NONE" }, recurrenceActive: true },
    include: { reminders: true },
  });

  const groups = new Map<string, OccWithReminders[]>();
  for (const e of recs) {
    const key = e.seriesId ?? e.id;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  for (const occs of groups.values()) {
    const latest = occs.reduce((a, b) => (a.startAt > b.startAt ? a : b));
    // Only spawn once the current occurrence has begun/passed.
    if (latest.startAt.getTime() > Date.now()) continue;
    try {
      await spawnNext(latest, tz);
    } catch (err) {
      console.error(`[recurrence] spawn failed for ${latest.id}:`, err);
    }
  }
}

async function spawnNext(latest: OccWithReminders, tz: string) {
  const now = DateTime.now().setZone(tz);
  let start: DateTime = DateTime.fromJSDate(latest.startAt).setZone(tz);
  do {
    start = addRecurrence(start, latest.recurrence);
  } while (start <= now && latest.recurrence !== "NONE");
  if (latest.recurrence === "NONE") return;

  const startAt = start.toUTC().toJSDate();
  const durationMs =
    (latest.endAt ? latest.endAt.getTime() : latest.startAt.getTime() + 3_600_000) -
    latest.startAt.getTime();
  const endAt = new Date(startAt.getTime() + Math.max(durationMs, 0));

  const calendarId = calendarIdForKind(latest.kind);
  const gcalEventId = await createCalendarEvent(
    {
      title: latest.title,
      description: latest.description,
      location: latest.location,
      url: latest.url,
      startAt,
      endAt,
      allDay: latest.allDay,
      timezone: tz,
    },
    calendarId,
  );

  // Rebuild reminders from the previous occurrence's template (dedupe offsets).
  const seen = new Set<number>();
  const reminderCreates: Prisma.ReminderCreateWithoutEventInput[] = [];
  const nowDate = new Date();
  for (const r of latest.reminders) {
    if (r.isAnnouncement) continue;
    if (seen.has(r.offsetMinutes)) continue;
    seen.add(r.offsetMinutes);
    const dueAt = computeDueAt(startAt, r.offsetMinutes);
    reminderCreates.push({
      offsetMinutes: r.offsetMinutes,
      channelId: r.channelId || null,
      dueAt,
      label: offsetLabel(r.offsetMinutes),
      status: dueAt < nowDate ? ReminderStatus.CANCELLED : ReminderStatus.PENDING,
    });
  }
  if (latest.announceOnCreate) {
    reminderCreates.push({
      offsetMinutes: 0,
      channelId: null,
      dueAt: nowDate,
      label: "Announcement",
      isAnnouncement: true,
      status: ReminderStatus.PENDING,
    });
  }

  await prisma.event.create({
    data: {
      guildId: latest.guildId,
      title: latest.title,
      description: latest.description,
      kind: latest.kind,
      startAt,
      endAt,
      allDay: latest.allDay,
      durationMinutes: latest.durationMinutes,
      recurrence: latest.recurrence,
      recurrenceActive: true,
      seriesId: latest.seriesId ?? latest.id,
      location: latest.location,
      url: latest.url,
      channelId: latest.channelId,
      announceOnCreate: latest.announceOnCreate,
      createdBy: latest.createdBy,
      gcalEventId,
      gcalCalendarId: gcalEventId ? calendarId : null,
      reminders: { create: reminderCreates },
    },
  });

  console.log(
    `[recurrence] spawned next "${latest.title}" at ${startAt.toISOString()}`,
  );
}
