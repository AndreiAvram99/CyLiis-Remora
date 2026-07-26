"use server";

import { revalidatePath } from "next/cache";
import { prisma, type RsvpStatus } from "@repo/db";
import type { RsvpStatusName } from "@repo/shared";
import { assertManager } from "@/lib/session";

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
