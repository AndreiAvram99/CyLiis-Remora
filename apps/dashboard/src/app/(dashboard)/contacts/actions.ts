"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { assertManager, assertMaster } from "@/lib/session";
import { env } from "@/lib/env";
import {
  contactSchema,
  orgProfileSchema,
  type OrgProfileValues,
} from "@/lib/validation";
import {
  deleteLogo,
  logoUrlFor,
  readSvgUpload,
  saveLogo,
  type LogoTone,
} from "@/lib/contact-logo";

/**
 * Files can only be sent as FormData, so the whole contact comes that way and
 * the fields are parsed back out. A logo is written after the contact exists,
 * since the url it's served from carries the contact's id.
 */
export async function saveContact(formData: FormData) {
  await assertManager();

  const id = text(formData.get("id"));
  const values = contactSchema.parse({
    kind:
      text(formData.get("kind")) === "COLLABORATION"
        ? "COLLABORATION"
        : "SPONSOR",
    name: text(formData.get("name")) ?? "",
    featured: formData.get("featured") === "1",
    logoUrl: text(formData.get("logoUrl")),
    logoLightUrl: text(formData.get("logoLightUrl")),
    person: text(formData.get("person")),
    role: text(formData.get("role")),
    email: text(formData.get("email")),
    phone: text(formData.get("phone")),
    instagram: text(formData.get("instagram")),
    linkedin: text(formData.get("linkedin")),
    website: text(formData.get("website")),
    notes: text(formData.get("notes")),
  });

  // Read the uploads before touching the database: a bad file should leave
  // nothing half-saved.
  const uploads: { tone: LogoTone; data: Uint8Array<ArrayBuffer> | null }[] =
    [];
  for (const tone of ["DARK", "LIGHT"] as const) {
    const field = tone === "DARK" ? "logo" : "logoLight";
    const file = formData.get(field);
    if (file instanceof File && file.size > 0) {
      uploads.push({ tone, data: await readSvgUpload(file) });
    } else if (formData.get(`${field}-clear`) === "1") {
      uploads.push({ tone, data: null });
    }
  }

  const contact = id
    ? await prisma.contact.update({ where: { id }, data: values })
    : await prisma.contact.create({
        data: { guildId: env.guildId(), ...values },
      });

  for (const { tone, data } of uploads) {
    const field = tone === "DARK" ? "logoUrl" : "logoLightUrl";
    if (data) {
      await saveLogo(contact.id, tone, data);
      await prisma.contact.update({
        where: { id: contact.id },
        data: { [field]: logoUrlFor(contact.id, tone) },
      });
    } else {
      await deleteLogo(contact.id, tone);
      await prisma.contact.update({
        where: { id: contact.id },
        data: { [field]: null },
      });
    }
  }

  revalidatePath("/contacts");
  return { ok: true, id: contact.id };
}

function text(value: FormDataEntryValue | null): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s === "" ? null : s;
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
