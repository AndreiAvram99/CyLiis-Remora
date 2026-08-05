"use server";

import { revalidatePath } from "next/cache";
import { prisma, type RsvpStatus } from "@repo/db";
import type { RsvpStatusName } from "@repo/shared";
import { assertManager, assertMaster } from "@/lib/session";
import { rosterIdentities } from "@/lib/members";
import { refreshEventPosts } from "@/lib/event-posts";

/**
 * Names and avatars live on the RSVP row, captured when the member taps a
 * button in Discord. Answering on their behalf has to carry that identity over
 * or the entry renders as a raw Discord id with no picture.
 */
async function identityOf(eventId: string, userId: string) {
  const [roster, invitee] = await Promise.all([
    rosterIdentities([userId]),
    prisma.eventInvitee.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { displayName: true, avatarUrl: true },
    }),
  ]);
  const live = roster.get(userId);
  // undefined leaves an existing value untouched on update.
  return {
    username: live?.username ?? undefined,
    displayName: live?.displayName ?? invitee?.displayName ?? undefined,
    avatarUrl: live?.avatarUrl ?? invitee?.avatarUrl ?? undefined,
  };
}

export async function setRsvpStatus(
  eventId: string,
  userId: string,
  status: RsvpStatusName,
) {
  const session = await assertManager();
  const who = await identityOf(eventId, userId);
  await prisma.rsvp.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: {
      eventId,
      userId,
      ...who,
      status: status as RsvpStatus,
      overriddenBy: session.user?.discordId ?? "admin",
    },
    update: {
      ...who,
      status: status as RsvpStatus,
      overriddenBy: session.user?.discordId ?? "admin",
    },
  });
  revalidatePath("/presence");
}

export async function removeRsvp(eventId: string, userId: string) {
  await assertManager();
  await prisma.rsvp
    .delete({ where: { eventId_userId: { eventId, userId } } })
    .catch(() => undefined);
  revalidatePath("/presence");
}

/**
 * Someone who turns out not to be needed at this meeting. Dropping them from
 * the expected list takes away the black mark they'd otherwise pick up, and
 * rewrites the roll-call in Discord — without announcing the change, since
 * nothing about the meeting itself moved.
 */
export async function dropExpectedAttendee(eventId: string, userId: string) {
  await assertMaster();
  await prisma.eventInvitee
    .delete({ where: { eventId_userId: { eventId, userId } } })
    .catch(() => undefined);
  await refreshEventPosts(eventId);
  revalidatePath("/presence");
}
