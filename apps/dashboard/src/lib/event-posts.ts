import { prisma, RsvpStatus } from "@repo/db";
import {
  buildEventEmbedPayload,
  emptyRsvpCounts,
  eventPostFooter,
  type ExpectedAttendee,
  type RsvpCounts,
  type RsvpStatusName,
} from "@repo/shared";
import { editChannelMessage } from "./discord";

/** Who is expected at a meeting and what they've answered. Empty otherwise. */
async function expectedAttendees(
  eventId: string,
  kind: string,
): Promise<ExpectedAttendee[]> {
  if (kind !== "MEETING") return [];
  const [invitees, rsvps] = await Promise.all([
    prisma.eventInvitee.findMany({
      where: { eventId },
      select: { userId: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.rsvp.findMany({
      where: { eventId },
      select: { userId: true, status: true },
    }),
  ]);
  const answered = new Map(rsvps.map((r) => [r.userId, r.status]));
  return invitees.map((i) => ({
    userId: i.userId,
    status: (answered.get(i.userId) as RsvpStatusName | undefined) ?? null,
  }));
}

async function rsvpCounts(eventId: string): Promise<RsvpCounts> {
  const grouped = await prisma.rsvp.groupBy({
    by: ["status"],
    where: { eventId },
    _count: { status: true },
  });
  const counts = emptyRsvpCounts();
  for (const g of grouped) {
    if (g.status === RsvpStatus.GOING) counts.GOING = g._count.status;
    if (g.status === RsvpStatus.MOTIVATED) counts.MOTIVATED = g._count.status;
  }
  return counts;
}

/**
 * Bring every post about a schedule back in line with the database — the
 * roll-call, the counts, the details. Used when something changes outside
 * Discord, like an admin dropping someone from the expected list.
 *
 * Only the embed is rewritten, so nobody is pinged a second time. A post that
 * can no longer be edited (deleted by hand, channel gone) is skipped rather
 * than failing the action that triggered this.
 */
export async function refreshEventPosts(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return;

  const posts = await prisma.reminder.findMany({
    where: { eventId, messageId: { not: null } },
    select: {
      channelId: true,
      messageId: true,
      isAnnouncement: true,
      label: true,
    },
  });
  if (posts.length === 0) return;

  const [counts, expected] = await Promise.all([
    rsvpCounts(eventId),
    expectedAttendees(eventId, event.kind),
  ]);

  for (const post of posts) {
    if (!post.messageId) continue;
    const footer = eventPostFooter(post.isAnnouncement, post.label);
    try {
      await editChannelMessage(
        post.channelId || event.channelId,
        post.messageId,
        {
          embeds: [
            buildEventEmbedPayload(event, counts, footer, expected),
          ],
        },
      );
    } catch (err) {
      console.error(`[posts] could not refresh ${post.messageId}:`, err);
    }
  }
}
