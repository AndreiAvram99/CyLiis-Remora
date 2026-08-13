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

/**
 * Text channels the bot has cached, for a picker. Which of them belongs to the
 * server rather than to this code: CHANNEL_ALLOWLIST names the ones worth
 * offering, matched case-insensitively, and an unset list offers all of them.
 */
export async function getTextChannels() {
  const allow = new Set(env.channelAllowlist());

  const channels = await prisma.channel.findMany({
    where: { guildId: env.guildId(), isTextable: true, archived: false },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

  if (allow.size === 0) return channels;
  return channels.filter((c) => allow.has(c.name.toLowerCase()));
}
