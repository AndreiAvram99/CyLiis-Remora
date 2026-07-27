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
 * Channels offered in the announcement/reminder pickers. We deliberately show
 * only the content channels (from the server's category screenshots) and hide
 * everything else (general chat, off-topic, apology channel, etc.). Override at
 * runtime with ALLOWED_CHANNEL_NAMES (comma-separated); empty uses this list.
 */
const DEFAULT_ALLOWED_CHANNELS = [
  "announcements",
  "hardware",
  "robot-ideas-and-sketches",
  "printing",
  "resources",
  "robot-bobocus",
  "documentation",
  "events",
  "sustenability",
  "branding",
  "pagination",
];

/** Text channels the bot has cached, filtered to the allowlist and ordered. */
export async function getTextChannels() {
  const channels = await prisma.channel.findMany({
    where: { guildId: env.guildId(), isTextable: true, archived: false },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

  const override = env.allowedChannelNames();
  const allowed = new Set(
    override.length ? override : DEFAULT_ALLOWED_CHANNELS,
  );
  return channels.filter((c) => allowed.has(c.name.toLowerCase()));
}
