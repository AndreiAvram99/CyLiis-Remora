"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { assertMaster } from "@/lib/session";
import { env } from "@/lib/env";
import { refreshEventPosts } from "@/lib/event-posts";

/** Award a mark by hand. Owner-only, on top of the ones derived from meetings. */
export async function addMemberMark(
  userId: string,
  kind: "BLACK" | "WHITE",
  reason: string,
) {
  const session = await assertMaster();
  if (!userId) throw new Error("Pick a member first.");

  await prisma.memberMark.create({
    data: {
      guildId: env.guildId(),
      userId,
      kind,
      reason: reason.trim() || null,
      createdBy: session?.user?.discordId ?? null,
    },
  });
  revalidatePath("/leaderboard");
  revalidatePath("/presence");
}

/** Withdraw a hand-added mark. Derived black marks can't be removed this way. */
export async function removeMemberMark(id: string) {
  await assertMaster();
  await prisma.memberMark.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/leaderboard");
  revalidatePath("/presence");
}

/**
 * Take back the black mark from a meeting someone never answered. The mark is
 * derived from being on the expected list, so clearing it means saying they
 * weren't expected after all — which also updates the roll-call in Discord.
 */
export async function clearMissedMark(eventId: string, userId: string) {
  await assertMaster();
  await prisma.eventInvitee
    .delete({ where: { eventId_userId: { eventId, userId } } })
    .catch(() => undefined);
  await refreshEventPosts(eventId);
  revalidatePath("/leaderboard");
  revalidatePath("/presence");
}
