import {
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  type Client,
} from "discord.js";
import { prisma, EventKind, type Event } from "@repo/db";

/**
 * Create a native Discord Scheduled Event so members get Discord's built-in
 * "interested" count and notifications. Idempotent per event.
 *
 * Meetings are intentionally skipped — a native Discord scheduled event is
 * meant for community-facing events, not internal meetings.
 */
export async function ensureScheduledEvent(
  client: Client,
  guildId: string,
  event: Event,
): Promise<string | null> {
  if (event.kind === EventKind.MEETING || event.kind === EventKind.PRINT) {
    return null;
  }
  if (event.discordScheduledEventId) return event.discordScheduledEventId;
  if (event.startAt.getTime() <= Date.now()) return null;

  try {
    const guild = await client.guilds.fetch(guildId);
    const end = event.endAt ?? new Date(event.startAt.getTime() + 60 * 60 * 1000);
    const location =
      (event.location || event.url || "See announcement").slice(0, 100);

    const scheduled = await guild.scheduledEvents.create({
      name: event.title.slice(0, 100),
      scheduledStartTime: event.startAt,
      scheduledEndTime: end,
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType: GuildScheduledEventEntityType.External,
      entityMetadata: { location },
      description: event.description?.slice(0, 1000) || undefined,
    });

    await prisma.event.update({
      where: { id: event.id },
      data: { discordScheduledEventId: scheduled.id },
    });
    return scheduled.id;
  } catch (err) {
    console.error("[scheduledEvent] create failed:", err);
    return null;
  }
}

/**
 * Delete Discord scheduled events created by the bot whose backing DB event no
 * longer exists (i.e. deleted from the dashboard). Runs each poll cycle.
 */
export async function reconcileScheduledEvents(client: Client, guildId: string) {
  try {
    const guild = await client.guilds.fetch(guildId);
    const existing = await guild.scheduledEvents.fetch();

    const rows = await prisma.event.findMany({
      where: { guildId, discordScheduledEventId: { not: null } },
      select: { discordScheduledEventId: true },
    });
    const known = new Set(rows.map((r) => r.discordScheduledEventId));

    for (const se of existing.values()) {
      if (se.creatorId === client.user?.id && !known.has(se.id)) {
        await se.delete().catch(() => undefined);
      }
    }
  } catch (err) {
    console.error("[scheduledEvent] reconcile failed:", err);
  }
}

/** Read the current "interested" count for an event's Discord scheduled event. */
export async function getInterestedCount(
  client: Client,
  guildId: string,
  scheduledEventId: string,
): Promise<number | null> {
  try {
    const guild = await client.guilds.fetch(guildId);
    const se = await guild.scheduledEvents.fetch({
      guildScheduledEvent: scheduledEventId,
      withUserCount: true,
    });
    return se.userCount ?? null;
  } catch {
    return null;
  }
}

/** Refresh the stored Discord "interested" snapshot for recent/upcoming events. */
export async function updateInterestedCounts(client: Client, guildId: string) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: {
      guildId,
      discordScheduledEventId: { not: null },
      startAt: { gte: cutoff },
    },
    select: { id: true, discordScheduledEventId: true, interestedCount: true },
  });

  for (const e of events) {
    const count = await getInterestedCount(
      client,
      guildId,
      e.discordScheduledEventId as string,
    );
    if (count !== null && count !== e.interestedCount) {
      await prisma.event.update({
        where: { id: e.id },
        data: { interestedCount: count },
      });
    }
  }
}
