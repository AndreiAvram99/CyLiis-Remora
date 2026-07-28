import { DateTime } from "luxon";
import { CalendarDays, Hash, FileDown } from "lucide-react";
import { prisma, RsvpStatus } from "@repo/db";
import type { RsvpStatusName } from "@repo/shared";
import { Badge, Card } from "@/components/ui";
import { getGuild } from "@/lib/guild";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { formatInTz, relativeTo } from "@/lib/time";
import { EditableMember } from "./member-controls";

export const dynamic = "force-dynamic";

interface Person {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: RsvpStatus;
  overriddenBy: string | null;
}

function displayNameOf(p: Person): string {
  return p.displayName || p.username || p.userId;
}

const KIND_STYLES: Record<string, string> = {
  MEETING: "bg-palette-sky/20 text-palette-sky",
  EVENT: "bg-palette-sun/15 text-palette-sun",
  CUSTOM: "bg-palette-flame/20 text-palette-flame",
};

// Avatars stay neutral (understated); status is conveyed by the column header
// color + dot, per the design system's "minimal use of color" rule.
const AVATAR_NEUTRAL = "bg-neutral-800 text-neutral-300";

// Status accents used for the group headers and dots.
const STATUS_TONE: Record<string, { text: string; dot: string }> = {
  GOING: { text: "text-palette-azure", dot: "bg-palette-azure" },
  NO: { text: "text-palette-flame", dot: "bg-palette-flame" },
  MOTIVATED: { text: "text-palette-sun", dot: "bg-palette-sun" },
};

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

/** The member's Discord avatar, or their initials when we don't have one. */
function MemberAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={24}
        height={24}
        className="h-6 w-6 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${AVATAR_NEUTRAL}`}
    >
      {initials(name)}
    </span>
  );
}

function MemberChip({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  return (
    <span className="flex max-w-full items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 py-1 pl-1 pr-3 text-sm">
      <MemberAvatar name={name} avatarUrl={avatarUrl} />
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );
}

function Group({
  title,
  people,
  statusKey,
  eventId,
  isManager,
}: {
  title: string;
  people: Person[];
  statusKey: keyof typeof STATUS_TONE;
  eventId: string;
  isManager: boolean;
}) {
  const tone = STATUS_TONE[statusKey];
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
        <span className={tone.text}>{title}</span>
        <span className="text-neutral-600">{people.length}</span>
      </div>
      {people.length === 0 ? (
        <p className="text-sm text-neutral-600">Nobody yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {people.map((p) =>
            isManager ? (
              <EditableMember
                key={p.userId}
                eventId={eventId}
                userId={p.userId}
                name={displayNameOf(p)}
                avatarUrl={p.avatarUrl}
                status={p.status as RsvpStatusName}
                overridden={Boolean(p.overriddenBy)}
              />
            ) : (
              <MemberChip
                key={p.userId}
                name={displayNameOf(p)}
                avatarUrl={p.avatarUrl}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

interface EventWithRsvps {
  id: string;
  kind: string;
  title: string;
  startAt: Date;
  channelId: string;
  rsvps: Person[];
}

function EventCard({
  e,
  timezone,
  isManager,
}: {
  e: EventWithRsvps;
  timezone: string;
  isManager: boolean;
}) {
  const going = e.rsvps.filter((r) => r.status === RsvpStatus.GOING);
  const cant = e.rsvps.filter((r) => r.status === RsvpStatus.NO);
  const motivated = e.rsvps.filter((r) => r.status === RsvpStatus.MOTIVATED);
  const participating = going.length;
  const isPast = e.startAt < new Date();

  return (
    <Card className={`space-y-4 ${isPast ? "opacity-80" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge className={KIND_STYLES[e.kind]}>{e.kind}</Badge>
            <span className="text-lg font-medium">{e.title}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <CalendarDays size={12} />
              {formatInTz(e.startAt, timezone)} ({relativeTo(e.startAt)})
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-palette-azure">
            {participating}
          </div>
          <div className="text-xs text-neutral-500">participating</div>
          <a
            href={`/api/presence/pdf?eventId=${e.id}`}
            className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-100"
          >
            <FileDown size={12} /> PDF
          </a>
        </div>
      </div>

      {e.rsvps.length === 0 ? (
        <p className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-4 text-sm text-neutral-500">
          No responses yet. Members RSVP by tapping the buttons on the event
          announcement in Discord.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-3">
          <Group
            title="Going"
            people={going}
            statusKey="GOING"
            eventId={e.id}
            isManager={isManager}
          />
          <Group
            title="Can't make it"
            people={cant}
            statusKey="NO"
            eventId={e.id}
            isManager={isManager}
          />
          <Group
            title="Motivation"
            people={motivated}
            statusKey="MOTIVATED"
            eventId={e.id}
            isManager={isManager}
          />
        </div>
      )}
    </Card>
  );
}

/** Parse a yyyy-mm-dd query param into a JS Date at the start/end of that day. */
function boundary(
  value: string | undefined,
  edge: "start" | "end",
  zone: string,
): Date | null {
  if (!value) return null;
  const dt = DateTime.fromISO(value, { zone });
  if (!dt.isValid) return null;
  return (edge === "start" ? dt.startOf("day") : dt.endOf("day")).toJSDate();
}

export default async function PresencePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const guild = await getGuild();
  const session = await getSession();
  const isManager = Boolean(session?.user?.isManager);

  const { from, to } = await searchParams;
  const fromDate = boundary(from, "start", guild.timezone);
  const toDate = boundary(to, "end", guild.timezone);

  const startAtFilter: { gte?: Date; lte?: Date } = {};
  if (fromDate) startAtFilter.gte = fromDate;
  if (toDate) startAtFilter.lte = toDate;

  const events = await prisma.event.findMany({
    where: {
      guildId: env.guildId(),
      ...(fromDate || toDate ? { startAt: startAtFilter } : {}),
    },
    orderBy: { startAt: "asc" },
    include: {
      rsvps: {
        select: {
          userId: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          status: true,
          overriddenBy: true,
        },
        orderBy: { displayName: "asc" },
      },
    },
  });

  const channels = await prisma.channel.findMany({
    where: { guildId: env.guildId() },
    select: { id: true, name: true, position: true },
  });
  const channelName = new Map(channels.map((c) => [c.id, c.name]));
  const channelPos = new Map(channels.map((c) => [c.id, c.position]));

  // Print requests don't collect presence, so keep them off this page.
  const presenceEvents = events.filter((e) => e.kind !== "PRINT");

  // Group the (already date-filtered) events by their announcement channel.
  const byChannel = new Map<string, EventWithRsvps[]>();
  for (const e of presenceEvents) {
    const list = byChannel.get(e.channelId) ?? [];
    list.push(e);
    byChannel.set(e.channelId, list);
  }
  const channelIds = [...byChannel.keys()].sort(
    (a, b) => (channelPos.get(a) ?? 999) - (channelPos.get(b) ?? 999),
  );

  // Preserve the active date range when exporting.
  const pdfQuery = new URLSearchParams();
  if (from) pdfQuery.set("from", from);
  if (to) pdfQuery.set("to", to);
  const pdfHref = `/api/presence/pdf${pdfQuery.toString() ? `?${pdfQuery}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight sm:text-[38px] sm:leading-tight">
            Presence
          </h1>
          <p className="max-w-2xl text-sm text-neutral-500">
            Who from the server is participating, grouped by channel.
            {isManager
              ? " You can correct a member's status or remove them; adjusted entries are marked."
              : ""}
          </p>
        </div>
        {presenceEvents.length > 0 ? (
          <a
            href={pdfHref}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-700"
          >
            <FileDown size={16} /> Export{from || to ? " range" : " all"} (PDF)
          </a>
        ) : null}
      </div>

      <Card className="space-y-3">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            From
            <input
              type="date"
              name="from"
              defaultValue={from ?? ""}
              className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-3 py-2 text-sm text-neutral-200 outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            To
            <input
              type="date"
              name="to"
              defaultValue={to ?? ""}
              className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-3 py-2 text-sm text-neutral-200 outline-none focus:border-brand"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-700"
          >
            Apply
          </button>
          {from || to ? (
            <a
              href="/presence"
              className="rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:text-neutral-100"
            >
              Clear
            </a>
          ) : null}
        </form>
      </Card>

      {channelIds.length === 0 ? (
        <Card className="text-sm text-neutral-400">
          {from || to
            ? "No events in this date range."
            : "No events yet."}
        </Card>
      ) : (
        channelIds.map((channelId) => (
          <section key={channelId} className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
              <Hash size={14} />
              {channelName.get(channelId) ?? "unknown"}
              <span className="text-neutral-600">
                ({byChannel.get(channelId)!.length})
              </span>
            </h2>
            <div className="space-y-4">
              {byChannel.get(channelId)!.map((e) => (
                <EventCard
                  key={e.id}
                  e={e}
                  timezone={guild.timezone}
                  isManager={isManager}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
