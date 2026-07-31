"use server";

import { revalidatePath } from "next/cache";
import { prisma, type RsvpStatus } from "@repo/db";
import type { RsvpStatusName } from "@repo/shared";
import { assertManager, assertMaster } from "@/lib/session";
import { env } from "@/lib/env";

export async function setRsvpStatus(
  eventId: string,
  userId: string,
  status: RsvpStatusName,
) {
  const session = await assertManager();
  await prisma.rsvp.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: {
      eventId,
      userId,
      status: status as RsvpStatus,
      overriddenBy: session.user?.discordId ?? "admin",
    },
    update: {
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
  revalidatePath("/presence");
}

/** Withdraw a hand-added mark. Derived black marks can't be removed this way. */
export async function removeMemberMark(id: string) {
  await assertMaster();
  await prisma.memberMark.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/presence");
}
