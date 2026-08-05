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

/**
 * A refused post is usually a permission or a channel that will be sorted out
 * minutes later, so give it a handful of goes on a widening delay rather than
 * losing the announcement. Minutes after each failure; running out means we
 * stop and leave it for a manager to save the schedule again.
 */
const RETRY_DELAYS = [5, 15, 45, 120, 360];

/** How often the sweep bothers the database, regardless of the poll interval. */
const RETRY_SWEEP_MS = 5 * 60 * 1000;

/** Few at a time: a broken channel shouldn't cost a burst of API calls. */
const RETRY_BATCH = 5;

async function deliverReminder(
  client: Client,
  reminderId: string,
  retrying = false,
) {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: { event: true },
  });
  if (!reminder) return;
  const expected = retrying
    ? ReminderStatus.FAILED
    : ReminderStatus.PENDING;
  if (reminder.status !== expected) return;

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
        attempts: reminder.attempts + 1,
        nextAttemptAt: null,
      },
    });
    console.log(
      `[scheduler] sent ${reminder.isAnnouncement ? "announcement" : "reminder"} for "${event.title}"${retrying ? " (retry)" : ""}`,
    );
  } catch (err) {
    const attempts = reminder.attempts + 1;
    const delay = RETRY_DELAYS[attempts - 1];
    // Nothing to gain from posting a reminder for something already underway.
    const worthRetrying = delay !== undefined && event.startAt > new Date();

    console.error(
      `[scheduler] failed reminder ${reminder.id} (try ${attempts}):`,
      err,
    );
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        status: ReminderStatus.FAILED,
        error: err instanceof Error ? err.message : String(err),
        attempts,
        nextAttemptAt: worthRetrying
          ? new Date(Date.now() + delay * 60_000)
          : null,
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

/**
 * Second pass over posts Discord refused. Whatever was in the way — a missing
 * permission, a channel nobody had invited the bot to — is usually fixed by
 * hand soon after, and this picks the post back up without anyone re-saving the
 * schedule. One indexed query on a slow cadence, so it costs next to nothing.
 */
async function retryFailedReminders(client: Client) {
  const stale = await prisma.reminder.findMany({
    where: {
      status: ReminderStatus.FAILED,
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: RETRY_BATCH,
    select: { id: true },
  });

  for (const r of stale) {
    await deliverReminder(client, r.id, true);
  }
}

export function startScheduler(client: Client) {
  const intervalMs = env.pollSeconds() * 1000;
  let running = false;
  let lastSweep = 0;

  const tick = async () => {
    if (running) return; // avoid overlapping cycles
    running = true;
    try {
      await advanceRecurringSeries(
        env.guildId(),
        await guildTimezone(env.guildId()),
      );
      await processDueReminders(client);
      if (Date.now() - lastSweep >= RETRY_SWEEP_MS) {
        lastSweep = Date.now();
        await retryFailedReminders(client);
      }
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
