import { type Client } from "discord.js";
import { prisma, ReminderStatus } from "@repo/db";
import { env } from "./env.js";
import { buildEventMessage } from "./messages.js";
import { getExpectedAttendees, getRsvpCounts } from "./rsvp.js";
import { advanceRecurringSeries } from "./recurrence.js";
import {
  ensureScheduledEvent,
  reconcileScheduledEvents,
  updateInterestedCounts,
} from "./scheduledEvents.js";

/** The guild's configured timezone, falling back to the env default. */
async function guildTimezone(guildId: string): Promise<string> {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    select: { timezone: true },
  });
  return guild?.timezone || env.timezone();
}

const BATCH_SIZE = 25;

async function deliverReminder(client: Client, reminderId: string) {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: { event: true },
  });
  if (!reminder || reminder.status !== ReminderStatus.PENDING) return;

  const event = reminder.event;
  const channelId = reminder.channelId || event.channelId;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || !("send" in channel)) {
      throw new Error(`Channel ${channelId} is not sendable`);
    }

    // Make sure a native Discord scheduled event exists for future events.
    if (
      !event.discordScheduledEventId &&
      event.startAt.getTime() > Date.now()
    ) {
      await ensureScheduledEvent(client, env.guildId(), event);
    }

    const counts = await getRsvpCounts(event.id);
    const expected = await getExpectedAttendees(event.id, event.kind);
    const message = await channel.send(
      buildEventMessage(event, counts, {
        announcement: reminder.isAnnouncement,
        leadLabel: reminder.label,
        expected,
      }),
    );

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        status: ReminderStatus.SENT,
        sentAt: new Date(),
        messageId: message.id,
        error: null,
      },
    });
    console.log(
      `[scheduler] sent ${reminder.isAnnouncement ? "announcement" : "reminder"} for "${event.title}"`,
    );
  } catch (err) {
    console.error(`[scheduler] failed reminder ${reminder.id}:`, err);
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        status: ReminderStatus.FAILED,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

async function processDueReminders(client: Client) {
  const due = await prisma.reminder.findMany({
    where: { status: ReminderStatus.PENDING, dueAt: { lte: new Date() } },
    orderBy: { dueAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true },
  });

  for (const r of due) {
    await deliverReminder(client, r.id);
  }
}

export function startScheduler(client: Client) {
  const intervalMs = env.pollSeconds() * 1000;
  let running = false;

  const tick = async () => {
    if (running) return; // avoid overlapping cycles
    running = true;
    try {
      await advanceRecurringSeries(
        env.guildId(),
        await guildTimezone(env.guildId()),
      );
      await processDueReminders(client);
      await reconcileScheduledEvents(client, env.guildId());
      await updateInterestedCounts(client, env.guildId());
    } catch (err) {
      console.error("[scheduler] tick error:", err);
    } finally {
      running = false;
    }
  };

  console.log(`[scheduler] polling every ${env.pollSeconds()}s`);
  void tick();
  setInterval(() => void tick(), intervalMs);
}
