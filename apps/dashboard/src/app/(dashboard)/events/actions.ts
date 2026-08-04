"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma, ReminderStatus, type Prisma } from "@repo/db";
import {
  allowedMentionsFor,
  buildPrintMessagePayload,
  computeDueAt,
  mentionPrefix,
  offsetLabel,
  FILAMENT_TYPES,
  DEFAULT_FILAMENT,
  DEFAULT_INFILL,
  DEFAULT_WALL_COUNT,
  DEFAULT_PRINT_COLOR,
  PRINT_COLORS,
  PRINT_STATUSES,
  PRINT_STATUS_EMOJI,
  PRINT_STATUS_LABELS,
  type FilamentType,
  type PrintStatus,
} from "@repo/shared";
import { assertManager, assertMaster } from "@/lib/session";
import { getGuild } from "@/lib/guild";
import { env } from "@/lib/env";
import { localInputToDate } from "@/lib/time";
import { channelColorOf } from "@/lib/channel-color";
import { describeScheduleChanges } from "@/lib/schedule-diff";
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

interface ResolvedSchedule {
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  durationMinutes: number | null;
}

async function colorForChannel(channelId: string): Promise<string | undefined> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { name: true, color: true },
  });
  return channel ? channelColorOf(channel) : undefined;
}

/**
 * Turn form values into concrete start/end times. All-day events (kind EVENT)
 * are a date range; meetings carry a duration from which endAt is derived.
 */
function resolveSchedule(values: EventFormValues, tz: string): ResolvedSchedule {
  const startAt = localInputToDate(values.startAt, tz);
  if (values.allDay) {
    const endAt = values.endAt ? localInputToDate(values.endAt, tz) : startAt;
    return { startAt, endAt, allDay: true, durationMinutes: null };
  }
  const duration =
    values.durationMinutes && values.durationMinutes > 0
      ? values.durationMinutes
      : 60;
  return {
    startAt,
    endAt: new Date(startAt.getTime() + duration * 60_000),
    allDay: false,
    durationMinutes: duration,
  };
}

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

/**
 * Expected-attendee rows for a meeting. Names and avatars are snapshotted from
 * the cached roster so the list still reads correctly if someone later leaves
 * the server or changes their nickname.
 */
async function buildInviteeCreates(values: EventFormValues) {
  if (values.kind !== "MEETING" || values.attendeeIds.length === 0) return [];

  const members = await prisma.guildMember.findMany({
    where: { id: { in: values.attendeeIds } },
    select: { id: true, displayName: true, username: true, avatarUrl: true },
  });
  const byId = new Map(members.map((m) => [m.id, m]));

  return values.attendeeIds.map((userId) => {
    const m = byId.get(userId);
    return {
      userId,
      displayName: m?.displayName || m?.username || null,
      avatarUrl: m?.avatarUrl ?? null,
    };
  });
}

export async function createEvent(input: EventFormValues) {
  const session = await assertManager();
  const values = eventFormSchema.parse(input);
  const guild = await getGuild();

  const { startAt, endAt, allDay, durationMinutes } = resolveSchedule(
    values,
    guild.timezone,
  );
  const channelColor = await colorForChannel(values.channelId);

  const calendarId = calendarIdForKind(values.kind);
  const gcalEventId = await createCalendarEvent(
    {
      title: values.title,
      description: values.description,
      location: values.location,
      url: values.url || null,
      startAt,
      endAt,
      allDay,
      timezone: guild.timezone,
      recurrence: values.recurrence,
      color: channelColor,
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
      allDay,
      durationMinutes,
      recurrence: values.recurrence,
      seriesId: values.recurrence !== "NONE" ? randomUUID() : null,
      location: values.location || null,
      url: values.url || null,
      channelId: values.channelId,
      announceOnCreate: values.announceOnCreate,
      mentionRoleIds: values.mentionRoleIds,
      mentionUserIds: values.mentionUserIds,
      mentionEveryone: values.mentionEveryone,
      createdBy: session.user?.discordId,
      gcalEventId,
      gcalCalendarId: gcalEventId ? calendarId : null,
      reminders: { create: buildReminderCreates(startAt, values) },
      invitees: { create: await buildInviteeCreates(values) },
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

  const { startAt, endAt, allDay, durationMinutes } = resolveSchedule(
    values,
    guild.timezone,
  );
  const channelColor = await colorForChannel(values.channelId);

  const calInput = {
    title: values.title,
    description: values.description,
    location: values.location,
    url: values.url || null,
    startAt,
    endAt,
    allDay,
    timezone: guild.timezone,
    recurrence: values.recurrence,
    color: channelColor,
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

  const invitees = await buildInviteeCreates(values);

  // Replace all not-yet-sent reminders; keep SENT ones for the audit trail.
  await prisma.$transaction([
    prisma.reminder.deleteMany({
      where: { eventId: id, status: { in: [ReminderStatus.PENDING, ReminderStatus.CANCELLED] } },
    }),
    // The picker submits the full expected list, so replace it wholesale.
    prisma.eventInvitee.deleteMany({ where: { eventId: id } }),
    prisma.event.update({
      where: { id },
      data: {
        title: values.title,
        description: values.description || null,
        kind: values.kind,
        startAt,
        endAt,
        allDay,
        durationMinutes,
        recurrence: values.recurrence,
        // Keep an existing series id; start a new series if it just became recurring.
        seriesId:
          values.recurrence !== "NONE"
            ? (existing.seriesId ?? randomUUID())
            : existing.seriesId,
        location: values.location || null,
        url: values.url || null,
        channelId: values.channelId,
        announceOnCreate: values.announceOnCreate,
        mentionRoleIds: values.mentionRoleIds,
        mentionUserIds: values.mentionUserIds,
        mentionEveryone: values.mentionEveryone,
        gcalEventId,
        gcalCalendarId,
        reminders: {
          create: buildReminderCreates(startAt, values).filter(
            // Don't re-announce on edit if it was already announced.
            (r) => !(r.isAnnouncement && existing.announceOnCreate),
          ),
        },
        invitees: { create: invitees },
      },
    }),
  ]);

  // Tell the channel what moved, so nobody works off the old details. Posted to
  // the new channel when the schedule was moved, which is where people look.
  const changes = describeScheduleChanges(existing, {
    title: values.title,
    description: values.description || null,
    kind: values.kind,
    startAt,
    endAt,
    allDay,
    durationMinutes,
    location: values.location || null,
    url: values.url || null,
    channelId: values.channelId,
    recurrence: values.recurrence,
  });

  if (changes.length > 0) {
    const mentions = {
      roleIds: values.mentionRoleIds,
      userIds: values.mentionUserIds,
      everyone: values.mentionEveryone,
    };
    const ping = mentionPrefix(mentions);

    await postChannelMessage(values.channelId, {
      content: `${ping ? `${ping}\n` : ""}🔄 **Schedule updated** — ${values.title}\n${changes.join("\n")}`,
      allowed_mentions: allowedMentionsFor(mentions),
    }).catch((err) =>
      console.error("[events] update message failed:", err),
    );
  }

  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  revalidatePath("/presence");
  return { id, changed: changes.length > 0 };
}

export interface PrintFormState {
  error: string | null;
  ok?: boolean;
}

// Discord's default upload cap for a bot without server boosts.
const MAX_PRINT_FILE_BYTES = 8 * 1024 * 1024;

function normalizeFilament(value: FormDataEntryValue | null): FilamentType {
  const v = String(value ?? "");
  return FILAMENT_TYPES.includes(v as FilamentType)
    ? (v as FilamentType)
    : DEFAULT_FILAMENT;
}

function normalizeInfill(value: FormDataEntryValue | null): number {
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return DEFAULT_INFILL;
  return Math.min(Math.max(Math.round(n), 0), 100);
}

function normalizeWalls(value: FormDataEntryValue | null): number {
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n) || n < 1) return DEFAULT_WALL_COUNT;
  return Math.min(Math.floor(n), 999);
}

function normalizeColor(value: FormDataEntryValue | null): string {
  const v = String(value ?? "").trim().toUpperCase();
  const match = PRINT_COLORS.find((c) => c.toUpperCase() === v);
  return match ?? DEFAULT_PRINT_COLOR;
}

function normalizeBool(value: FormDataEntryValue | null): boolean {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
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

function normalizeCopies(value: FormDataEntryValue | null): number {
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n) || n < 1) return 1;
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
 * aligned with per-file 3D settings) and returns validation state.
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
    const orders = formData.getAll("order");
    const copies = formData.getAll("copies");
    const filaments = formData.getAll("filamentType");
    const infills = formData.getAll("infill");
    const walls = formData.getAll("wallCount");
    const colors = formData.getAll("color");
    const supports = formData.getAll("needsSupport");

    // All the per-file arrays are appended together, so they align by index.
    const rows = rawFiles
      .map((f, i) => ({
        file: f,
        order: normalizeOrder(orders[i] ?? null),
        copies: normalizeCopies(copies[i] ?? null),
        filamentType: normalizeFilament(filaments[i] ?? null),
        infill: normalizeInfill(infills[i] ?? null),
        wallCount: normalizeWalls(walls[i] ?? null),
        color: normalizeColor(colors[i] ?? null),
        needsSupport: normalizeBool(supports[i] ?? null),
      }))
      .filter(
        (r): r is {
          file: File;
          order: number;
          copies: number;
          filamentType: FilamentType;
          infill: number;
          wallCount: number;
          color: string;
          needsSupport: boolean;
        } => r.file instanceof File && r.file.size > 0,
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
            order: r.order,
            copies: r.copies,
            filamentType: r.filamentType,
            infill: r.infill,
            wallCount: r.wallCount,
            color: r.color,
            needsSupport: r.needsSupport,
          })),
        },
      },
    });

    const payload = buildPrintMessagePayload({
      eventId: event.id,
      files: rows.map((r) => ({
        name: r.file.name,
        order: r.order,
        copies: r.copies,
        filamentType: r.filamentType,
        infill: r.infill,
        wallCount: r.wallCount,
        color: r.color,
        needsSupport: r.needsSupport,
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
  order: number;
  copies: number;
  filamentType: string;
  infill: number;
  wallCount: number;
  color: string;
  needsSupport: boolean;
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
    const order = normalizeOrder(String(edit.order));
    const pieces = normalizeCopies(String(edit.copies));
    const filamentType = normalizeFilament(edit.filamentType);
    const infill = normalizeInfill(String(edit.infill));
    const wallCount = normalizeWalls(String(edit.wallCount));
    const color = normalizeColor(edit.color);
    const needsSupport = !!edit.needsSupport;
    if (
      order !== current.order ||
      pieces !== current.copies ||
      filamentType !== current.filamentType ||
      infill !== current.infill ||
      wallCount !== current.wallCount ||
      color.toUpperCase() !== current.color.toUpperCase() ||
      needsSupport !== current.needsSupport
    ) {
      updates.push({
        id: edit.id,
        order,
        copies: pieces,
        filamentType,
        infill,
        wallCount,
        color,
        needsSupport,
      });
      const bits: string[] = [];
      if (filamentType !== current.filamentType) bits.push(filamentType);
      if (infill !== current.infill) bits.push(`${infill}% infill`);
      if (wallCount !== current.wallCount) bits.push(`${wallCount} walls`);
      if (color.toUpperCase() !== current.color.toUpperCase()) {
        bits.push(`🎨 ${color.toUpperCase()}`);
      }
      if (needsSupport !== current.needsSupport) {
        bits.push(needsSupport ? "needs support" : "no support");
      }
      if (pieces !== current.copies) bits.push(`×${pieces}`);
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
        data: {
          order: u.order,
          copies: u.copies,
          filamentType: u.filamentType,
          infill: u.infill,
          wallCount: u.wallCount,
          color: u.color,
          needsSupport: u.needsSupport,
        },
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
      order: f.order,
      copies: f.copies,
      filamentType: f.filamentType,
      infill: f.infill,
      wallCount: f.wallCount,
      color: f.color,
      needsSupport: f.needsSupport,
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
  // Deleting is owner-only; managers can still create and edit.
  await assertMaster();
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) return;

  // For a recurring schedule, stop future occurrences but keep past ones (and
  // their attendance) intact — only the upcoming occurrence is removed.
  if (existing.recurrence !== "NONE" && existing.seriesId) {
    await prisma.event.updateMany({
      where: { seriesId: existing.seriesId },
      data: { recurrenceActive: false },
    });
  }

  if (existing.gcalEventId) {
    const calendarId = existing.gcalCalendarId ?? env.googleCalendarId();
    await deleteCalendarEvent(calendarId, existing.gcalEventId);
  }
  // The worker reconciles/removes the matching Discord scheduled event.
  await prisma.event.delete({ where: { id } });

  revalidatePath("/events");
  revalidatePath("/presence");
}
