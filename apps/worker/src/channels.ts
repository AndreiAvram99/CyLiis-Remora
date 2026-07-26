import { ChannelType, type Client, type GuildBasedChannel } from "discord.js";
import { prisma } from "@repo/db";

const TEXT_TYPES = new Set<ChannelType>([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
]);

function typeName(type: ChannelType): string {
  return ChannelType[type] ?? String(type);
}

/**
 * Mirror the guild's text channels into the DB so the dashboard has a live
 * channel picker. Channels that disappeared are marked archived (not deleted,
 * so historical events keep a readable channel name).
 */
export async function syncChannels(client: Client, guildId: string) {
  const guild = await client.guilds.fetch(guildId);
  await guild.channels.fetch();

  await prisma.guild.upsert({
    where: { id: guild.id },
    create: { id: guild.id, name: guild.name, memberCount: guild.memberCount },
    update: { name: guild.name, memberCount: guild.memberCount },
  });

  const seen = new Set<string>();

  for (const channel of guild.channels.cache.values()) {
    const ch = channel as GuildBasedChannel;
    if (!TEXT_TYPES.has(ch.type)) continue;
    seen.add(ch.id);
    await prisma.channel.upsert({
      where: { id: ch.id },
      create: {
        id: ch.id,
        guildId: guild.id,
        name: ch.name,
        type: typeName(ch.type),
        position: "position" in ch ? (ch.position ?? 0) : 0,
        isTextable: true,
        archived: false,
      },
      update: {
        name: ch.name,
        type: typeName(ch.type),
        position: "position" in ch ? (ch.position ?? 0) : 0,
        isTextable: true,
        archived: false,
      },
    });
  }

  // Archive channels we no longer see.
  const stored = await prisma.channel.findMany({
    where: { guildId: guild.id, archived: false },
    select: { id: true },
  });
  const toArchive = stored.filter((c) => !seen.has(c.id)).map((c) => c.id);
  if (toArchive.length > 0) {
    await prisma.channel.updateMany({
      where: { id: { in: toArchive } },
      data: { archived: true },
    });
  }

  console.log(`[channels] synced ${seen.size} text channels`);
}
