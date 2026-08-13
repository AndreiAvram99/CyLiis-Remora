import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { isContactKind } from "@repo/shared";
import { requireManager } from "@/lib/session";
import type { ContactValues } from "@/lib/validation";
import { ContactForm } from "../contact-form";

export const dynamic = "force-dynamic";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;
  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) notFound();

  const initial: ContactValues = {
    kind: isContactKind(contact.kind) ? contact.kind : "SPONSOR",
    name: contact.name,
    person: contact.person,
    role: contact.role,
    email: contact.email,
    phone: contact.phone,
    instagram: contact.instagram,
    linkedin: contact.linkedin,
    website: contact.website,
    notes: contact.notes,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold tracking-tight sm:text-[38px] sm:leading-tight">
        {contact.name}
      </h1>
      <ContactForm id={contact.id} initial={initial} />
    </div>
  );
}
