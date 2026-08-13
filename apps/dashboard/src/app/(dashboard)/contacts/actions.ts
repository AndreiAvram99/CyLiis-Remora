"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { assertManager, assertMaster } from "@/lib/session";
import { env } from "@/lib/env";
import {
  contactSchema,
  orgProfileSchema,
  type ContactValues,
  type OrgProfileValues,
} from "@/lib/validation";

export async function createContact(input: ContactValues) {
  await assertManager();
  const values = contactSchema.parse(input);

  const contact = await prisma.contact.create({
    data: { guildId: env.guildId(), ...values },
    select: { id: true },
  });

  revalidatePath("/contacts");
  return { ok: true, id: contact.id };
}

export async function updateContact(id: string, input: ContactValues) {
  await assertManager();
  const values = contactSchema.parse(input);

  await prisma.contact.update({ where: { id }, data: values });

  revalidatePath("/contacts");
  return { ok: true };
}

/** Deleting is the owner's call, as with schedules. */
export async function deleteContact(id: string) {
  await assertMaster();
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/contacts");
  return { ok: true };
}

export async function updateOrgProfile(input: OrgProfileValues) {
  await assertManager();
  const values = orgProfileSchema.parse(input);
  const guildId = env.guildId();

  await prisma.orgProfile.upsert({
    where: { guildId },
    create: { guildId, ...values },
    update: values,
  });

  revalidatePath("/contacts");
  return { ok: true };
}
