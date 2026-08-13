import { prisma } from "@repo/db";
import { env } from "@/lib/env";
import { requireManager } from "@/lib/session";
import type { OrgProfileValues } from "@/lib/validation";
import { OrgForm } from "../org-form";

export const dynamic = "force-dynamic";

export default async function OrganisationPage() {
  await requireManager();
  const org = await prisma.orgProfile.findUnique({
    where: { guildId: env.guildId() },
  });

  const initial: OrgProfileValues = {
    name: org?.name ?? null,
    address: org?.address ?? null,
    fiscalCode: org?.fiscalCode ?? null,
    iban: org?.iban ?? null,
    bank: org?.bank ?? null,
    representative: org?.representative ?? null,
    email: org?.email ?? null,
    phone: org?.phone ?? null,
    website: org?.website ?? null,
    instagram: org?.instagram ?? null,
    linkedin: org?.linkedin ?? null,
    notes: org?.notes ?? null,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold tracking-tight sm:text-[38px] sm:leading-tight">
        Our organisation
      </h1>
      <p className="text-sm text-neutral-500">
        The details a sponsor, a school or an invoice asks for. Fill in what we
        have; blanks simply don&apos;t show up on the page.
      </p>
      <OrgForm initial={initial} />
    </div>
  );
}
