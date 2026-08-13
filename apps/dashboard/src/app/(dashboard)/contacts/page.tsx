import Link from "next/link";
import {
  Building2,
  Contact as ContactIcon,
  Globe,
  Handshake,
  Instagram,
  Linkedin,
  Mail,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  Star,
} from "lucide-react";
import { prisma } from "@repo/db";
import {
  CONTACT_KINDS,
  CONTACT_KIND_TITLES,
  type ContactKind,
} from "@repo/shared";
import { Button, Card } from "@/components/ui";
import { env } from "@/lib/env";
import { isMasterId, requireMember } from "@/lib/session";
import { CopyOrgDetails } from "./copy-org-details";
import { DeleteContact } from "./contact-actions";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<ContactKind, typeof Handshake> = {
  SPONSOR: Sparkles,
  COLLABORATION: Handshake,
};

/** One line of the organisation's own details, skipped when we don't have it. */
function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="w-40 shrink-0 text-sm text-neutral-500">{label}</span>
      <span className="min-w-0 break-words text-sm text-neutral-100">
        {value}
      </span>
    </div>
  );
}

/** A way of reaching someone, rendered as a link wherever that makes sense. */
function Reach({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Mail;
  label: string;
  href?: string;
}) {
  const body = (
    <>
      <Icon size={14} className="shrink-0 text-neutral-500" />
      <span className="min-w-0 truncate">{label}</span>
    </>
  );
  const className =
    "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-[rgb(var(--line))] bg-neutral-950 px-2.5 py-1 text-sm text-neutral-200";

  if (!href) return <span className={className}>{body}</span>;
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className={`${className} transition hover:border-brand/40 hover:text-neutral-100`}
    >
      {body}
    </a>
  );
}

/**
 * A sponsor's own mark, in whichever version survives the current background.
 * When only one file was given it's used for both — most logos cope.
 */
function SponsorLogo({
  name,
  dark,
  light,
  className,
}: {
  name: string;
  dark: string | null;
  light: string | null;
  className: string;
}) {
  if (!dark && !light) return null;
  const onDark = dark ?? light!;
  const onLight = light ?? dark!;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={onDark}
        alt={name}
        className={`show-on-dark w-auto object-contain ${className}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={onLight}
        alt=""
        aria-hidden
        className={`show-on-light w-auto object-contain ${className}`}
      />
    </>
  );
}

type Reachable = {
  email: string | null;
  phone: string | null;
  instagram: string | null;
  linkedin: string | null;
  website: string | null;
};

/** Every way we have of reaching someone, in one row. */
function Reaches({ contact: c }: { contact: Reachable }) {
  return (
    <div className="flex flex-wrap gap-2">
      {c.email ? (
        <Reach icon={Mail} label={c.email} href={`mailto:${c.email}`} />
      ) : null}
      {c.phone ? (
        <Reach
          icon={Phone}
          label={c.phone}
          href={`tel:${c.phone.replace(/\s+/g, "")}`}
        />
      ) : null}
      {c.instagram ? (
        <Reach
          icon={Instagram}
          label={
            c.instagram.startsWith("@")
              ? c.instagram
              : `@${c.instagram.replace(/^https?:\/\/\S+\//, "")}`
          }
          href={instagramUrl(c.instagram)}
        />
      ) : null}
      {c.linkedin ? (
        <Reach
          icon={Linkedin}
          label="LinkedIn"
          href={externalUrl(c.linkedin)}
        />
      ) : null}
      {c.website ? (
        <Reach
          icon={Globe}
          label={c.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          href={externalUrl(c.website)}
        />
      ) : null}
    </div>
  );
}

function instagramUrl(handle: string): string {
  const clean = handle.replace(/^@/, "").replace(/^https?:\/\/\S+\//, "");
  return `https://instagram.com/${clean}`;
}

function externalUrl(value: string): string {
  return value.startsWith("http") ? value : `https://${value}`;
}

export default async function ContactsPage() {
  const session = await requireMember();
  const isManager = Boolean(session.user?.isManager);
  const isMaster = isMasterId(session.user?.discordId);
  const guildId = env.guildId();

  const [org, contacts] = await Promise.all([
    prisma.orgProfile.findUnique({ where: { guildId } }),
    prisma.contact.findMany({
      where: { guildId },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  const hasOrg =
    org &&
    [
      org.name,
      org.address,
      org.fiscalCode,
      org.iban,
      org.bank,
      org.representative,
      org.email,
      org.phone,
    ].some(Boolean);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight sm:text-[38px] sm:leading-tight">
            <ContactIcon size={30} className="text-brand" />
            Contacts
          </h1>
          <p className="max-w-2xl text-sm text-neutral-500">
            Our own details for the paperwork a sponsor asks for, and everyone
            worth reaching outside the team. Nothing but a name is required — a
            phone number on its own is a perfectly good contact.
          </p>
        </div>
        {isManager ? (
          <Link href="/contacts/new">
            <Button>
              <Plus size={18} />
              New contact
            </Button>
          </Link>
        ) : null}
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-100">
            <Building2 size={18} className="text-brand" />
            Our organisation
          </h2>
          <div className="flex items-center gap-2">
            {hasOrg ? <CopyOrgDetails org={org} /> : null}
            {isManager ? (
              <Link href="/contacts/organisation">
                <Button variant="secondary" className="h-9 px-3">
                  <Pencil size={16} />
                  Edit
                </Button>
              </Link>
            ) : null}
          </div>
        </div>

        {hasOrg ? (
          <div className="space-y-2">
            <Detail label="Name" value={org.name} />
            <Detail label="Address" value={org.address} />
            <Detail label="Fiscal code" value={org.fiscalCode} />
            <Detail label="IBAN" value={org.iban} />
            <Detail label="Bank" value={org.bank} />
            <Detail label="Representative" value={org.representative} />
            <Detail label="Contact" value={org.email} />
            <Detail label="Phone" value={org.phone} />
            {org.notes ? (
              <p className="whitespace-pre-wrap pt-2 text-sm text-neutral-400">
                {org.notes}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            {isManager
              ? "Nothing saved yet. Add the legal name, fiscal code and bank account once, and it's there whenever a sponsor asks."
              : "Nothing saved yet."}
          </p>
        )}
      </Card>

      {CONTACT_KINDS.map((kind) => {
        const all = contacts.filter((c) => c.kind === kind);
        // A main sponsor is shown once, in its own frame above the grid.
        const headline =
          kind === "SPONSOR" ? all.filter((c) => c.featured) : [];
        const rows = all.filter((c) => !headline.includes(c));
        const Icon = KIND_ICON[kind];
        return (
          <section key={kind} className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-100">
              <Icon size={18} className="text-brand" />
              {CONTACT_KIND_TITLES[kind]}
              <span className="text-sm font-normal text-neutral-500">
                {all.length}
              </span>
            </h2>

            {headline.map((c) => (
              <div key={c.id} className="sponsor-frame">
                <div className="space-y-4 bg-neutral-900 p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand">
                        <Star size={12} className="shrink-0" />
                        Main sponsor
                      </span>
                      <SponsorLogo
                        name={c.name}
                        dark={c.logoUrl}
                        light={c.logoLightUrl}
                        className="h-16 max-w-[260px]"
                      />
                      {/* The logo carries the name, including for screen readers. */}
                      {c.logoUrl || c.logoLightUrl ? null : (
                        <p className="text-2xl font-semibold tracking-tight text-neutral-100">
                          {c.name}
                        </p>
                      )}
                      {c.person ? (
                        <p className="text-sm text-neutral-500">
                          {c.person}
                          {c.role ? ` · ${c.role}` : ""}
                        </p>
                      ) : null}
                    </div>
                    {isManager ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Link
                          href={`/contacts/${c.id}`}
                          title="Edit"
                          aria-label="Edit"
                        >
                          <Button variant="secondary" className="w-11 px-0">
                            <Pencil className="h-5 w-5" />
                          </Button>
                        </Link>
                        {isMaster ? <DeleteContact id={c.id} /> : null}
                      </div>
                    ) : null}
                  </div>

                  {c.notes ? (
                    <p className="max-w-2xl whitespace-pre-wrap text-sm text-neutral-300">
                      {c.notes}
                    </p>
                  ) : null}

                  <Reaches contact={c} />
                </div>
              </div>
            ))}

            {rows.length === 0 ? (
              headline.length === 0 ? (
                <Card className="p-5">
                  <p className="text-sm text-neutral-500">
                    None yet.
                    {isManager
                      ? " Add the first one with “New contact”."
                      : null}
                  </p>
                </Card>
              ) : null
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {rows.map((c) => (
                  <Card key={c.id} className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <SponsorLogo
                          name={c.name}
                          dark={c.logoUrl}
                          light={c.logoLightUrl}
                          className="mb-1.5 h-7 max-w-[150px]"
                        />
                        <p className="truncate font-medium text-neutral-100">
                          {c.name}
                        </p>
                        {c.person ? (
                          <p className="truncate text-sm text-neutral-500">
                            {c.person}
                            {c.role ? ` · ${c.role}` : ""}
                          </p>
                        ) : null}
                      </div>
                      {isManager ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Link
                            href={`/contacts/${c.id}`}
                            title="Edit"
                            aria-label="Edit"
                          >
                            <Button variant="secondary" className="w-11 px-0">
                              <Pencil className="h-5 w-5" />
                            </Button>
                          </Link>
                          {isMaster ? <DeleteContact id={c.id} /> : null}
                        </div>
                      ) : null}
                    </div>

                    <Reaches contact={c} />

                    {c.notes ? (
                      <p className="whitespace-pre-wrap text-sm text-neutral-400">
                        {c.notes}
                      </p>
                    ) : null}
                  </Card>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
