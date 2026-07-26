"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { offsetLabel } from "@repo/shared";
import { assertManager } from "@/lib/session";
import { env } from "@/lib/env";
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
