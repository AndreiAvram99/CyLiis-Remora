"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { offsetLabel, printDefaultsOf, type PrintDefaults } from "@repo/shared";
import { assertManager } from "@/lib/session";
import { env } from "@/lib/env";
import { channelColorOf } from "@/lib/channel-color";
import { updateCalendarEventColor } from "@/lib/gcal";
import { settingsSchema, type SettingsValues } from "@/lib/validation";

export async function updateSettings(input: SettingsValues) {
  await assertManager();
  const values = settingsSchema.parse(input);
  const guildId = env.guildId();

  await prisma.guild.update({
    where: { id: guildId },
    data: {
      timezone: values.timezone,
      defaultChannelId: values.defaultChannelId || null,
    },
  });

  // Replace the default reminder set atomically.
  await prisma.$transaction([
    prisma.reminderDefault.deleteMany({ where: { guildId } }),
    prisma.reminderDefault.createMany({
      data: values.defaults.map((d) => ({
        guildId,
        kind: d.kind,
        offsetMinutes: d.offsetMinutes,
        label: offsetLabel(d.offsetMinutes),
      })),
      skipDuplicates: true,
    }),
  ]);

  revalidatePath("/settings");
  revalidatePath("/events/new");
  return { ok: true };
}

/**
 * The slicer settings every new print file starts with. Managers set them once
 * so the usual request is a drag-and-drop with nothing to adjust.
 */
export async function updatePrintDefaults(input: PrintDefaults) {
  await assertManager();
  const values = printDefaultsOf({
    printFilament: input.filamentType,
    printInfill: input.infill,
    printWallCount: input.wallCount,
    printColor: input.color,
    printSupport: input.needsSupport,
  });

  await prisma.guild.update({
    where: { id: env.guildId() },
    data: {
      printFilament: values.filamentType,
      printInfill: values.infill,
      printWallCount: values.wallCount,
      printColor: values.color,
      printSupport: values.needsSupport,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/events/new");
  return { ok: true };
}

/**
 * Set (or clear, with null) a channel's accent color. Shared across all admins
 * since it lives on the channel row. Accepts a #RRGGBB hex; anything else clears
 * it back to the derived default.
 */
export async function setChannelColor(channelId: string, color: string | null) {
  await assertManager();
  const clean =
    color && /^#[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : null;

  const channel = await prisma.channel.update({
    where: { id: channelId },
    data: { color: clean },
    select: { name: true, color: true },
  });

  // Keep existing upcoming/native recurring Google events visually aligned.
  // Patch color only, so titles, times and recurrence remain untouched.
  const events = await prisma.event.findMany({
    where: {
      channelId,
      kind: { not: "PRINT" },
      gcalEventId: { not: null },
      OR: [
        { startAt: { gte: new Date() } },
        { recurrence: { not: "NONE" }, recurrenceActive: true },
      ],
    },
    select: { gcalEventId: true, gcalCalendarId: true },
  });
  const targets = new Map<string, { calendarId: string; eventId: string }>();
  for (const event of events) {
    if (!event.gcalEventId) continue;
    const calendarId = event.gcalCalendarId ?? env.googleCalendarId();
    targets.set(`${calendarId}:${event.gcalEventId}`, {
      calendarId,
      eventId: event.gcalEventId,
    });
  }
  const resolvedColor = channelColorOf(channel);
  await Promise.all(
    [...targets.values()].map(({ calendarId, eventId }) =>
      updateCalendarEventColor(calendarId, eventId, resolvedColor),
    ),
  );

  revalidatePath("/settings");
  revalidatePath("/events");
  revalidatePath("/events/new");
  revalidatePath("/presence");
  return { ok: true, color: clean };
}
