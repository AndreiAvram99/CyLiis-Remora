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
  status: RsvpStatus;
  overriddenBy: string | null;
}

const KIND_STYLES: Record<string, string> = {
  MEETING: "bg-palette-sky/20 text-palette-sky",
  EVENT: "bg-palette-sun/15 text-palette-sun",
  CUSTOM: "bg-palette-flame/20 text-palette-flame",
};

// Avatars stay neutral (understated); status is conveyed by the column header
// color + dot, per the design system's "minimal use of color" rule.
export const AVATAR_NEUTRAL =
  "bg-neutral-800 text-neutral-300";

// Status accents used for the group headers and dots.
const STATUS_TONE: Record<string, { text: string; dot: string }> = {
  GOING: { text: "text-palette-azure", dot: "bg-palette-azure" },
  NO: { text: "text-palette-flame", dot: "bg-palette-flame" },
  MOTIVATED: { text: "text-palette-sun", dot: "bg-palette-sun" },
};

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function MemberChip({ name }: { name: string }) {
  return (
    <span className="flex max-w-full items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 py-1 pl-1 pr-3 text-sm">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${AVATAR_NEUTRAL}`}
      >
        {initials(name)}
      </span>
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
                name={p.username ?? p.userId}
                status={p.status as RsvpStatusName}
                overridden={Boolean(p.overriddenBy)}
              />
            ) : (
              <MemberChip key={p.userId} name={p.username ?? p.userId} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

export default async function PresencePage() {
  const guild = await getGuild();
  const session = await getSession();
  const isManager = Boolean(session?.user?.isManager);
  const now = new Date();

  const events = await prisma.event.findMany({
    where: { guildId: env.guildId() },
    orderBy: { startAt: "asc" },
    include: {
      rsvps: {
        select: {
          userId: true,
          username: true,
          status: true,
          overriddenBy: true,
        },
        orderBy: { username: "asc" },
      },
    },
  });

  const channels = await prisma.channel.findMany({
    where: { guildId: env.guildId() },
    select: { id: true, name: true },
  });
  const channelName = new Map(channels.map((c) => [c.id, c.name]));

  const ordered = [
    ...events.filter((e) => e.startAt >= now),
    ...events.filter((e) => e.startAt < now).reverse(),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight sm:text-[38px] sm:leading-tight">
            Presence
          </h1>
          <p className="max-w-2xl text-sm text-neutral-500">
            Who from the server is participating in each event.
            {isManager
              ? " You can correct a member's status or remove them; adjusted entries are marked."
              : ""}
          </p>
        </div>
        {ordered.length > 0 ? (
          <a
            href="/api/presence/pdf"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-700"
          >
            <FileDown size={16} /> Export all (PDF)
          </a>
        ) : null}
      </div>

      {ordered.length === 0 ? (
        <Card className="text-sm text-neutral-400">No events yet.</Card>
      ) : (
        ordered.map((e) => {
          const going = e.rsvps.filter((r) => r.status === RsvpStatus.GOING);
          const cant = e.rsvps.filter((r) => r.status === RsvpStatus.NO);
          const motivated = e.rsvps.filter(
            (r) => r.status === RsvpStatus.MOTIVATED,
          );
          const participating = going.length;
          const isPast = e.startAt < now;

          return (
            <Card key={e.id} className={`space-y-4 ${isPast ? "opacity-80" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className={KIND_STYLES[e.kind]}>{e.kind}</Badge>
                    <span className="text-lg font-medium">{e.title}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <CalendarDays size={12} />
                      {formatInTz(e.startAt, guild.timezone)} (
                      {relativeTo(e.startAt)})
                    </span>
                    <span className="flex items-center gap-1">
                      <Hash size={12} />
                      {channelName.get(e.channelId) ?? "unknown"}
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
                  No responses yet. Members RSVP by tapping the buttons on the
                  event announcement in Discord.
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
        })
      )}
    </div>
  );
}
