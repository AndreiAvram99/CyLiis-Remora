import Link from "next/link";
import { DateTime } from "luxon";
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  FileDown,
  Hash,
  Video,
  type LucideIcon,
} from "lucide-react";
import { prisma, RsvpStatus } from "@repo/db";
import type { RsvpStatusName } from "@repo/shared";
import { Badge, Card } from "@/components/ui";
import { getGuild } from "@/lib/guild";
import { channelColorOf } from "@/lib/channel-color";
import { loadMarks } from "@/lib/marks";
import { fillIdentities } from "@/lib/members";
import { BlackMark } from "@/components/marks";
import { env } from "@/lib/env";
import { getSession, isMasterId } from "@/lib/session";
import { formatInTz, relativeTo } from "@/lib/time";
import {
  AssignStatus,
  DropExpected,
  EditableMember,
} from "./member-controls";

export const dynamic = "force-dynamic";

interface Person {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: RsvpStatus;
  overriddenBy: string | null;
}

// A Discord id is 19 digits of noise, so name the gap instead of showing it.
const UNKNOWN = "Unknown member";

function displayNameOf(p: Person): string {
  return p.displayName || p.username || UNKNOWN;
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

interface Invitee {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface EventWithRsvps {
  id: string;
  kind: string;
  title: string;
  startAt: Date;
  channelId: string;
  rsvps: Person[];
  invitees: Invitee[];
}

/** Expected attendees who never answered Going or Motivation. */
function MissingZone({
  people,
  started,
  blackMarks,
  eventId,
  canAssign,
}: {
  people: Invitee[];
  started: boolean;
  blackMarks: Map<string, number>;
  eventId: string;
  canAssign: boolean;
}) {
  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <AlertTriangle size={13} className="text-red-400" />
        <span className="text-red-400">
          {started ? "Missed the meeting" : "Waiting on a reply"}
        </span>
        <span className="text-neutral-600">{people.length}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {people.map((p) => {
          const name = p.displayName || UNKNOWN;
          return (
            <span
              key={p.userId}
              className="flex max-w-full items-center gap-2 rounded-full border border-red-500/30 bg-neutral-950 py-1 pl-1 pr-2 text-sm"
            >
              <MemberAvatar name={name} avatarUrl={p.avatarUrl} />
              <span className="min-w-0 truncate">{name}</span>
              {started ? (
                <BlackMark count={blackMarks.get(p.userId) ?? 1} />
              ) : null}
              {canAssign ? (
                <>
                  <AssignStatus eventId={eventId} userId={p.userId} />
                  <DropExpected
                    eventId={eventId}
                    userId={p.userId}
                    name={name}
                  />
                </>
              ) : null}
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        {started
          ? "They were expected but never answered, so each carries a black mark. The number is their running total."
          : "Expected at this meeting. They still have time to answer in Discord."}
        {canAssign
          ? " Setting a status here answers on their behalf and clears the black mark; the person icon drops them from the expected list altogether, in Discord too."
          : null}
      </p>
    </div>
  );
}

function EventCard({
  e,
  timezone,
  isManager,
  isMaster,
  blackMarks,
}: {
  e: EventWithRsvps;
  timezone: string;
  isManager: boolean;
  isMaster: boolean;
  blackMarks: Map<string, number>;
}) {
  const going = e.rsvps.filter((r) => r.status === RsvpStatus.GOING);
  const motivated = e.rsvps.filter((r) => r.status === RsvpStatus.MOTIVATED);
  const participating = going.length;
  const isPast = e.startAt < new Date();

  const answered = new Set(
    e.rsvps
      .filter(
        (r) =>
          r.status === RsvpStatus.GOING || r.status === RsvpStatus.MOTIVATED,
      )
      .map((r) => r.userId),
  );
  const missing = e.invitees.filter((i) => !answered.has(i.userId));

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
          <div className="text-xs text-neutral-500">
            {e.invitees.length > 0
              ? `of ${e.invitees.length} expected`
              : "participating"}
          </div>
          <a
            href={`/api/presence/pdf?eventId=${e.id}`}
            className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-100"
          >
            <FileDown size={12} /> PDF
          </a>
        </div>
      </div>

      {e.rsvps.length === 0 && missing.length === 0 ? (
        <p className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-4 text-sm text-neutral-500">
          No responses yet. Members RSVP by tapping the buttons on the event
          announcement in Discord.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Group
              title="Going"
              people={going}
              statusKey="GOING"
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
          {missing.length > 0 ? (
            <MissingZone
              people={missing}
              started={isPast}
              blackMarks={blackMarks}
              eventId={e.id}
              canAssign={isMaster}
            />
          ) : null}
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

type View = "meetings" | "events";

const VIEWS: { key: View; label: string; icon: LucideIcon; blurb: string }[] = [
  {
    key: "meetings",
    label: "Meetings",
    icon: Video,
    blurb: "Meetings, grouped by the channel they were announced in.",
  },
  {
    key: "events",
    label: "Events",
    icon: CalendarRange,
    blurb: "Events, which the whole server can answer.",
  },
];

/** Meetings have an expected list; everything else is open to the server. */
function viewOf(kind: string): View {
  return kind === "MEETING" ? "meetings" : "events";
}

/** A channel's worth of schedules, split at today. */
function ChannelSection({
  name,
  color,
  upcoming,
  past,
  openPast,
  timezone,
  isManager,
  isMaster,
  blackMarks,
}: {
  name: string;
  color?: string;
  upcoming: EventWithRsvps[];
  past: EventWithRsvps[];
  openPast: boolean;
  timezone: string;
  isManager: boolean;
  isMaster: boolean;
  blackMarks: Map<string, number>;
}) {
  const card = (e: EventWithRsvps) => (
    <EventCard
      key={e.id}
      e={e}
      timezone={timezone}
      isManager={isManager}
      isMaster={isMaster}
      blackMarks={blackMarks}
    />
  );

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        <span
          className="h-3.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <Hash size={14} />
        {name}
        <span className="text-neutral-600">
          ({upcoming.length + past.length})
        </span>
      </h2>

      {upcoming.length > 0 ? (
        <div className="space-y-4">{upcoming.map(card)}</div>
      ) : null}

      {/* The record stays one click away rather than burying what's coming. */}
      {past.length > 0 ? (
        <details open={openPast || upcoming.length === 0} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-xs text-neutral-500 transition hover:text-neutral-300">
            <ChevronRight
              size={13}
              className="transition group-open:rotate-90"
            />
            Past ({past.length})
          </summary>
          <div className="mt-3 space-y-4">{past.map(card)}</div>
        </details>
      ) : null}
    </section>
  );
}

export default async function PresencePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; view?: string }>;
}) {
  const guild = await getGuild();
  const session = await getSession();
  const isManager = Boolean(session?.user?.isManager);
  const isMaster = isMasterId(session?.user?.discordId);

  const { from, to, view } = await searchParams;
  const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0];
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
      invitees: {
        select: { userId: true, displayName: true, avatarUrl: true },
        orderBy: { displayName: "asc" },
      },
    },
  });

  // Running black-mark totals across all history, not just the filtered range,
  // so each no-show chip can show the member's overall standing.
  const marks = await loadMarks();

  const channels = await prisma.channel.findMany({
    where: { guildId: env.guildId() },
    select: { id: true, name: true, position: true, color: true },
  });
  const channelName = new Map(channels.map((c) => [c.id, c.name]));
  const channelPos = new Map(channels.map((c) => [c.id, c.position]));
  const channelColor = new Map(channels.map((c) => [c.id, channelColorOf(c)]));

  // Print requests don't collect presence, so keep them off this page.
  const presenceEvents = events.filter((e) => e.kind !== "PRINT");

  await fillIdentities(presenceEvents);

  // Meetings and events answer different questions, so they never share a list.
  const inView = presenceEvents.filter((e) => viewOf(e.kind) === current.key);
  const countFor = (key: View) =>
    presenceEvents.filter((e) => viewOf(e.kind) === key).length;

  // Then by channel, since that's how the team is split day to day.
  const byChannel = new Map<string, EventWithRsvps[]>();
  for (const e of inView) {
    const list = byChannel.get(e.channelId) ?? [];
    list.push(e);
    byChannel.set(e.channelId, list);
  }
  const channelIds = [...byChannel.keys()].sort(
    (a, b) => (channelPos.get(a) ?? 999) - (channelPos.get(b) ?? 999),
  );

  const now = new Date();
  const filtered = Boolean(from || to);

  // Switching tabs keeps whatever date range is being looked at.
  const tabHref = (key: View) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (key !== VIEWS[0].key) params.set("view", key);
    const qs = params.toString();
    return `/presence${qs ? `?${qs}` : ""}`;
  };

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
            {current.blurb}
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

      <nav className="flex flex-wrap items-center gap-1">
        {VIEWS.map(({ key, label, icon: Icon }) => {
          const count = countFor(key);
          return (
            <Link
              key={key}
              href={tabHref(key)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
                current.key === key
                  ? "bg-neutral-800 font-medium text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              <Icon size={14} />
              {label}
              {count > 0 ? (
                <span className="text-xs text-neutral-500">{count}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <Card className="space-y-3">
        <form method="get" className="flex flex-wrap items-end gap-3">
          {current.key !== VIEWS[0].key ? (
            <input type="hidden" name="view" value={current.key} />
          ) : null}
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
          {filtered ? (
            <a
              href={
                current.key === VIEWS[0].key
                  ? "/presence"
                  : `/presence?view=${current.key}`
              }
              className="rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:text-neutral-100"
            >
              Clear
            </a>
          ) : null}
        </form>
      </Card>

      {channelIds.length === 0 ? (
        <Card className="text-sm text-neutral-400">
          {filtered
            ? `No ${current.label.toLowerCase()} in this date range.`
            : `No ${current.label.toLowerCase()} yet.`}
        </Card>
      ) : (
        channelIds.map((channelId) => {
          const list = byChannel.get(channelId)!;
          return (
            <ChannelSection
              key={channelId}
              name={channelName.get(channelId) ?? "unknown"}
              color={channelColor.get(channelId)}
              // Soonest first, so the next one to answer leads the section.
              upcoming={list.filter((e) => e.startAt >= now)}
              // Most recent first: last week matters more than last term.
              past={list.filter((e) => e.startAt < now).reverse()}
              openPast={filtered}
              timezone={guild.timezone}
              isManager={isManager}
              isMaster={isMaster}
              blackMarks={marks.blackByUser}
            />
          );
        })
      )}
    </div>
  );
}
