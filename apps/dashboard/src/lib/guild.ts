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
 * Channels shown in the picker by default. Set CHANNEL_ALLOWLIST to override.
 * Names are matched case-insensitively against the synced Discord channels.
 */
const DEFAULT_CHANNEL_ALLOWLIST = [
  "announcements",
  "events",
  "hardware",
  "andrei-fun",
  "sustenability",
  "branding",
  "printing",
  "pagination",
];

/** Text channels the bot has cached, filtered to the allowlist, for a picker. */
export async function getTextChannels() {
  const override = env.channelAllowlist();
  const allow = new Set(override.length ? override : DEFAULT_CHANNEL_ALLOWLIST);

  const channels = await prisma.channel.findMany({
    where: { guildId: env.guildId(), isTextable: true, archived: false },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

  return channels.filter((c) => allow.has(c.name.toLowerCase()));
}
