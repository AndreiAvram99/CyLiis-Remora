import { prisma, type Guild } from "@repo/db";
import { env } from "./env";

/** Get the managed guild, creating a placeholder row if the bot hasn't run yet. */
export async function getGuild(): Promise<Guild> {
  const id = env.guildId();
  const existing = await prisma.guild.findUnique({ where: { id } });
  if (existing) return existing;
  return prisma.guild.create({
    data: { id, name: "My Server", timezone: env.defaultTimezone() },
  });
}

/** Text channels the bot has cached, ordered for a picker. */
export async function getTextChannels() {
  return prisma.channel.findMany({
    where: { guildId: env.guildId(), isTextable: true, archived: false },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}
