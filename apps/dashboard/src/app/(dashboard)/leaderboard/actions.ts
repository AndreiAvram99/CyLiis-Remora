"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { assertMaster } from "@/lib/session";
import { env } from "@/lib/env";

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
