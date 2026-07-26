import { prisma } from "@repo/db";
import type { EventKindName } from "@repo/shared";
import { env } from "./env";

export type KindDefaults = Record<EventKindName, number[]>;

/** Load per-kind default reminder offsets (minutes), sorted descending. */
export async function getKindDefaults(): Promise<KindDefaults> {
  const rows = await prisma.reminderDefault.findMany({
    where: { guildId: env.guildId() },
    orderBy: { offsetMinutes: "desc" },
  });
  const result: KindDefaults = { MEETING: [], EVENT: [], CUSTOM: [] };
  for (const row of rows) {
    result[row.kind as EventKindName].push(row.offsetMinutes);
  }
  return result;
}
