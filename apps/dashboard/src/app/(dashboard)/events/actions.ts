"use server";

import { revalidatePath } from "next/cache";
import { prisma, ReminderStatus, type Prisma } from "@repo/db";
import {
  buildPrintMessagePayload,
  computeDueAt,
  offsetLabel,
  PRINT_PRIORITIES,
  PRINT_PRIORITY_EMOJI,
  PRINT_PRIORITY_LABELS,
  PRINT_STATUSES,
  PRINT_STATUS_EMOJI,
  PRINT_STATUS_LABELS,
  type PrintPriority,
  type PrintStatus,
} from "@repo/shared";
import { assertManager } from "@/lib/session";
import { getGuild } from "@/lib/guild";
import { env } from "@/lib/env";
import { localInputToDate } from "@/lib/time";
import {
  postChannelMessage,
  postChannelMessageWithFiles,
  editChannelMessage,
} from "@/lib/discord";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  calendarIdForKind,
} from "@/lib/gcal";
import { eventFormSchema, type EventFormValues } from "@/lib/validation";

function buildReminderCreates(
  startAt: Date,
  values: EventFormValues,
): Prisma.ReminderCreateWithoutEventInput[] {
  const now = new Date();
  const reminders: Prisma.ReminderCreateWithoutEventInput[] = [];

  for (const r of values.reminders) {
    const dueAt = computeDueAt(startAt, r.offsetMinutes);
    reminders.push({
      offsetMinutes: r.offsetMinutes,
      channelId: r.channelId || null,
      dueAt,
      label: offsetLabel(r.offsetMinutes),
      // Skip reminders that are already in the past so we don't fire stale pings.
      status: dueAt < now ? ReminderStatus.CANCELLED : ReminderStatus.PENDING,
    });
  }

  if (values.announceOnCreate) {
    reminders.push({
      offsetMinutes: 0,
      channelId: null,
      dueAt: now,
      label: "Announcement",
      isAnnouncement: true,
      status: ReminderStatus.PENDING,
    });
  }

  return reminders;
}

export async function createEvent(input: EventFormValues) {
  const session = await assertManager();
  const values = eventFormSchema.parse(input);
  const guild = await getGuild();

  const startAt = localInputToDate(values.startAt, guild.timezone);
  const endAt = values.endAt
    ? localInputToDate(values.endAt, guild.timezone)
    : null;

  const calendarId = calendarIdForKind(values.kind);
  const gcalEventId = await createCalendarEvent(
    {
      title: values.title,
      description: values.description,
      location: values.location,
      url: values.url || null,
      startAt,
      endAt,
      timezone: guild.timezone,
    },
    calendarId,
  );

  const event = await prisma.event.create({
    data: {
      guildId: guild.id,
      title: values.title,
      description: values.description || null,
      kind: values.kind,
      startAt,
      endAt,
      location: values.location || null,
      url: values.url || null,
      channelId: values.channelId,
      announceOnCreate: values.announceOnCreate,
      createdBy: session.user?.discordId,
      gcalEventId,
      gcalCalendarId: gcalEventId ? calendarId : null,
      reminders: { create: buildReminderCreates(startAt, values) },
    },
  });

  revalidatePath("/events");
  revalidatePath("/presence");
  return { id: event.id };
}

export async function updateEvent(id: string, input: EventFormValues) {
  await assertManager();
  const values = eventFormSchema.parse(input);
  const guild = await getGuild();
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) throw new Error("Event not found");

  const startAt = localInputToDate(values.startAt, guild.timezone);
  const endAt = values.endAt
    ? localInputToDate(values.endAt, guild.timezone)
    : null;

  const calInput = {
    title: values.title,
    description: values.description,
    location: values.location,
    url: values.url || null,
    startAt,
    endAt,
    timezone: guild.timezone,
  };
  const targetCalendar = calendarIdForKind(values.kind);
  let gcalEventId = existing.gcalEventId;
  let gcalCalendarId = existing.gcalCalendarId;

  if (existing.gcalEventId) {
    // Where the event currently lives (old rows predate gcalCalendarId).
    const currentCalendar = existing.gcalCalendarId ?? env.googleCalendarId();
    if (currentCalendar !== targetCalendar) {
      // The type changed, so it belongs in a different calendar now: move it.
      await deleteCalendarEvent(currentCalendar, existing.gcalEventId);
      gcalEventId = await createCalendarEvent(calInput, targetCalendar);
      gcalCalendarId = gcalEventId ? targetCalendar : null;
    } else {
      await updateCalendarEvent(currentCalendar, existing.gcalEventId, calInput);
      gcalCalendarId = currentCalendar;
    }
  } else {
    // Never pushed (e.g. created while sync was off) — try now.
    gcalEventId = await createCalendarEvent(calInput, targetCalendar);
    gcalCalendarId = gcalEventId ? targetCalendar : null;
  }

  // Replace all not-yet-sent reminders; keep SENT ones for the audit trail.
  await prisma.$transaction([
    prisma.reminder.deleteMany({
      where: { eventId: id, status: { in: [ReminderStatus.PENDING, ReminderStatus.CANCELLED] } },
    }),
    prisma.event.update({
      where: { id },
      data: {
        title: values.title,
        description: values.description || null,
        kind: values.kind,
        startAt,
        endAt,
        location: values.location || null,
        url: values.url || null,
        channelId: values.channelId,
        announceOnCreate: values.announceOnCreate,
        gcalEventId,
        gcalCalendarId,
        reminders: {
          create: buildReminderCreates(startAt, values).filter(
            // Don't re-announce on edit if it was already announced.
            (r) => !(r.isAnnouncement && existing.announceOnCreate),
          ),
        },
      },
    }),
  ]);

  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  revalidatePath("/presence");
  return { id };
}

export interface PrintFormState {
  error: string | null;
  ok?: boolean;
}

// Discord's default upload cap for a bot without server boosts.
const MAX_PRINT_FILE_BYTES = 8 * 1024 * 1024;

function normalizePriority(value: FormDataEntryValue | null): PrintPriority {
  const v = String(value ?? "").toUpperCase();
  return PRINT_PRIORITIES.includes(v as PrintPriority)
    ? (v as PrintPriority)
    : "NORMAL";
}

function normalizeStatus(value: FormDataEntryValue | null): PrintStatus {
  const v = String(value ?? "").toUpperCase();
  return PRINT_STATUSES.includes(v as PrintStatus)
    ? (v as PrintStatus)
    : "PENDING";
}

function normalizeOrder(value: FormDataEntryValue | null): number {
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), 9999);
}

/** Build a short title from the file names for the dashboard/list view. */
function titleFromFiles(names: string[]): string {
  if (names.length === 0) return "Print request";
  const base = names.length === 1 ? names[0] : `${names[0]} +${names.length - 1} more`;
  return base.slice(0, 200);
}

/**
 * Create a PRINT request: no reminders, no RSVP. Each file carries its own
 * importance + print order. Uploads the files straight to the chosen channel
 * with a "who's printing this?" claim button. Takes FormData (files[] aligned
 * with priority[] and order[]) and returns validation state.
 */
export async function createPrintRequest(
  _prev: PrintFormState,
  formData: FormData,
): Promise<PrintFormState> {
  try {
    const session = await assertManager();
    const guild = await getGuild();

    const description = String(formData.get("description") ?? "").trim();
    const channelId = String(formData.get("channelId") ?? "").trim();
    if (!channelId) return { error: "Pick a channel to post in." };

    const rawFiles = formData.getAll("files");
    const priorities = formData.getAll("priority");
    const orders = formData.getAll("order");

    // files[] / priority[] / order[] are appended together, so they align.
    const rows = rawFiles
      .map((f, i) => ({
        file: f,
        priority: normalizePriority(priorities[i] ?? null),
        order: normalizeOrder(orders[i] ?? null),
      }))
      .filter(
        (r): r is { file: File; priority: PrintPriority; order: number } =>
          r.file instanceof File && r.file.size > 0,
      );

    if (rows.length === 0) {
      return { error: "Attach at least one file to print." };
    }
    for (const r of rows) {
      if (r.file.size > MAX_PRINT_FILE_BYTES) {
        return {
          error: `"${r.file.name}" is larger than 8 MB — Discord won't accept it.`,
        };
      }
    }

    const filePayloads = await Promise.all(
      rows.map(async (r) => ({
        name: r.file.name,
        data: Buffer.from(await r.file.arrayBuffer()),
      })),
    );

    const event = await prisma.event.create({
      data: {
        guildId: guild.id,
        title: titleFromFiles(rows.map((r) => r.file.name)),
        description: description || null,
        kind: "PRINT",
        startAt: new Date(),
        channelId,
        announceOnCreate: false,
        createdBy: session.user?.discordId,
        printFiles: {
          create: rows.map((r) => ({
            name: r.file.name,
            priority: r.priority,
            order: r.order,
          })),
        },
      },
    });

    const payload = buildPrintMessagePayload({
      eventId: event.id,
      files: rows.map((r) => ({
        name: r.file.name,
        priority: r.priority,
        order: r.order,
      })),
      description: description || null,
      requesterName: session.user?.name ?? null,
      status: "PENDING",
    });

    try {
      const messageId = await postChannelMessageWithFiles(
        channelId,
        payload,
        filePayloads,
      );
      await prisma.event.update({
        where: { id: event.id },
        data: { printMessageId: messageId },
      });
    } catch (err) {
      // Don't leave a print request with nothing posted to Discord.
      await prisma.event.delete({ where: { id: event.id } }).catch(() => {});
      return {
        error:
          err instanceof Error
            ? `Couldn't post to Discord: ${err.message}`
            : "Couldn't post to Discord.",
      };
    }

    revalidatePath("/events");
    return { error: null, ok: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Something went wrong. Try again.",
    };
  }
}

export interface PrintFileEdit {
  id: string;
  priority: string;
  order: number;
}

/**
 * Manager-only edit of a print request: per-file importance/order plus the
 * request's overall status. Refreshes the original Discord post and posts a
 * separate update message summarizing what changed (only when it actually did).
 */
export async function updatePrintRequest(
  id: string,
  input: { status: string; files: PrintFileEdit[] },
) {
  await assertManager();
  const existing = await prisma.event.findUnique({
    where: { id },
    include: { printFiles: true },
  });
  if (!existing || existing.kind !== "PRINT") {
    throw new Error("Print request not found.");
  }

  const status = normalizeStatus(input.status);
  const byId = new Map(existing.printFiles.map((f) => [f.id, f]));
  const changes: string[] = [];

  if (status !== existing.printStatus) {
    changes.push(
      `Status → ${PRINT_STATUS_EMOJI[status]} **${PRINT_STATUS_LABELS[status]}**`,
    );
  }

  const updates: PrintFileEdit[] = [];
  for (const edit of input.files) {
    const current = byId.get(edit.id);
    if (!current) continue;
    const priority = normalizePriority(edit.priority);
    const order = normalizeOrder(String(edit.order));
    if (priority !== current.priority || order !== current.order) {
      updates.push({ id: edit.id, priority, order });
      const bits: string[] = [];
      if (priority !== current.priority) {
        bits.push(
          `${PRINT_PRIORITY_EMOJI[priority]} ${PRINT_PRIORITY_LABELS[priority]}`,
        );
      }
      if (order !== current.order) {
        bits.push(`order ${order > 0 ? `#${order}` : "unset"}`);
      }
      changes.push(`\`${current.name}\` → ${bits.join(", ")}`);
    }
  }

  await prisma.$transaction([
    prisma.event.update({ where: { id }, data: { printStatus: status } }),
    ...updates.map((u) =>
      prisma.printFile.update({
        where: { id: u.id },
        data: { priority: u.priority, order: u.order },
      }),
    ),
  ]);

  if (changes.length === 0) {
    revalidatePath("/events");
    return { id, changed: false };
  }

  // Rebuild from the freshly-updated files so the post reflects the new state.
  const files = await prisma.printFile.findMany({ where: { eventId: id } });
  const payload = buildPrintMessagePayload({
    eventId: id,
    files: files.map((f) => ({
      name: f.name,
      priority: f.priority,
      order: f.order,
    })),
    description: existing.description,
    requesterName: null,
    claimedByName: existing.printClaimedByName,
    status,
  });

  if (existing.printMessageId) {
    await editChannelMessage(existing.channelId, existing.printMessageId, {
      embeds: payload.embeds,
      components: payload.components,
    }).catch((err) => console.error("[print] edit original failed:", err));
  }

  await postChannelMessage(existing.channelId, {
    content: `🔄 **Print update**\n${changes.join("\n")}`,
  }).catch((err) => console.error("[print] update message failed:", err));

  revalidatePath("/events");
  return { id, changed: true };
}

export async function deleteEvent(id: string) {
  await assertManager();
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) return;

  if (existing.gcalEventId) {
    const calendarId = existing.gcalCalendarId ?? env.googleCalendarId();
    await deleteCalendarEvent(calendarId, existing.gcalEventId);
  }
  // The worker reconciles/removes the matching Discord scheduled event.
  await prisma.event.delete({ where: { id } });

  revalidatePath("/events");
  revalidatePath("/presence");
}
