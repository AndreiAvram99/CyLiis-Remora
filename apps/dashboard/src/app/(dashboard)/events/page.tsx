import Link from "next/link";
import { Plus, Pencil, MapPin, Hash, Bell, Printer } from "lucide-react";
import { prisma, RsvpStatus } from "@repo/db";
import { durationLabel, recurrenceBadge } from "@repo/shared";
import { Badge, Button, Card } from "@/components/ui";
import { getGuild } from "@/lib/guild";
import { env } from "@/lib/env";
import { getSession, isMasterId } from "@/lib/session";
import { formatInTz, relativeTo } from "@/lib/time";
import { AgendaButton } from "./agenda-button";
import { DeleteEventButton } from "./delete-button";
import { PrintCard } from "./print-card";

export const dynamic = "force-dynamic";

const KIND_STYLES: Record<string, string> = {
  MEETING: "bg-palette-sky/10 text-palette-sky",
  EVENT: "bg-palette-sun/10 text-palette-sun",
  CUSTOM: "bg-palette-flame/10 text-palette-flame",
  PRINT: "bg-palette-azure/10 text-palette-azure",
};

export default async function EventsPage() {
  const guild = await getGuild();
  const session = await getSession();
  const isManager = Boolean(session?.user?.isManager);
  const canDelete = isMasterId(session?.user?.discordId);
  const now = new Date();

  const events = await prisma.event.findMany({
    where: { guildId: env.guildId() },
    orderBy: { startAt: "asc" },
    include: {
      reminders: true,
      _count: { select: { rsvps: true } },
      rsvps: { select: { status: true } },
      printFiles: true,
    },
  });

  const channels = await prisma.channel.findMany({
    where: { guildId: env.guildId() },
    select: { id: true, name: true },
  });
  const channelName = new Map(channels.map((c) => [c.id, c.name]));

  // Rank a request by its most-pressing file: lowest positive print order wins,
  // so the request with the next thing to print floats to the top.
  const minOrder = (e: (typeof events)[number]) => {
    let m = Number.MAX_SAFE_INTEGER;
    for (const f of e.printFiles) {
      if (f.order > 0) m = Math.min(m, f.order);
    }
    return m;
  };
  const printRequests = events
    .filter((e) => e.kind === "PRINT")
    .sort((a, b) => minOrder(a) - minOrder(b));
  const upcoming = events.filter((e) => e.startAt >= now && e.kind !== "PRINT");
  const past = events.filter((e) => e.startAt < now && e.kind !== "PRINT");

  const guildId = env.guildId();
  const discordLink = (channelId: string, messageId: string) =>
    `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight sm:text-[38px] sm:leading-tight">
            Schedules
          </h1>
          <p className="text-sm text-neutral-500">
            Times shown in {guild.timezone}.
          </p>
        </div>
        {isManager ? (
          <Link href="/events/new">
            <Button variant="success">
              <Plus size={16} /> New schedule
            </Button>
          </Link>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <Card className="text-sm text-neutral-400">
            No upcoming events.{isManager ? " Create one to get started." : ""}
          </Card>
        ) : (
          upcoming.map((e) => {
            const going = e.rsvps.filter(
              (r) => r.status === RsvpStatus.GOING,
            ).length;
            const motivated = e.rsvps.filter(
              (r) => r.status === RsvpStatus.MOTIVATED,
            ).length;
            const pending = e.reminders.filter(
              (r) => r.status === "PENDING" && !r.isAnnouncement,
            ).length;
            return (
              <Card key={e.id} className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className={KIND_STYLES[e.kind]}>{e.kind}</Badge>
                    {isManager ? (
                      <Link
                        href={`/events/${e.id}`}
                        className="truncate text-lg font-medium hover:underline"
                      >
                        {e.title}
                      </Link>
                    ) : (
                      <span className="truncate text-lg font-medium">
                        {e.title}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-neutral-300">
                    {formatInTz(e.startAt, guild.timezone)}{" "}
                    <span className="text-neutral-500">
                      ({relativeTo(e.startAt)})
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Hash size={12} />
                      {channelName.get(e.channelId) ?? "unknown"}
                    </span>
                    {e.location ? (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {e.location}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1">
                      <Bell size={12} />
                      {pending} reminder{pending === 1 ? "" : "s"} scheduled
                    </span>
                    {e.kind === "MEETING" && e.durationMinutes ? (
                      <span>{durationLabel(e.durationMinutes)}</span>
                    ) : null}
                    {recurrenceBadge(e.recurrence) ? (
                      <span className="text-palette-azure">
                        {recurrenceBadge(e.recurrence)}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-palette-azure" />
                      {going} going
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-palette-sun" />
                      {motivated} motivation
                    </span>
                  </div>
                </div>
                {isManager ? (
                  <div className="flex items-center gap-2">
                    {e.kind === "MEETING" ? (
                      <AgendaButton id={e.id} docUrl={e.agendaDocUrl} />
                    ) : null}
                    <Link
                      href={`/events/${e.id}`}
                      title="Edit"
                      aria-label="Edit"
                    >
                      <Button
                        variant="secondary"
                        className="w-11 px-0 sm:w-auto sm:px-5"
                      >
                        <Pencil size={16} />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                    </Link>
                    {canDelete ? (
                      <DeleteEventButton id={e.id} title={e.title} />
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </section>

      {printRequests.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            <Printer size={14} /> Print requests ({printRequests.length})
          </h2>
          {printRequests.map((e) => (
            <PrintCard
              key={e.id}
              id={e.id}
              title={e.title}
              status={e.printStatus}
              channelName={channelName.get(e.channelId) ?? "unknown"}
              claimedByName={e.printClaimedByName ?? null}
              discordHref={
                e.printMessageId
                  ? discordLink(e.channelId, e.printMessageId)
                  : null
              }
              isManager={isManager}
              canDelete={canDelete}
              files={e.printFiles.map((f) => ({
                id: f.id,
                name: f.name,
                order: f.order,
                copies: f.copies,
                filamentType: f.filamentType,
                infill: f.infill,
                wallCount: f.wallCount,
                color: f.color,
                needsSupport: f.needsSupport,
              }))}
            />
          ))}
        </section>
      ) : null}

      {past.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Past ({past.length})
          </h2>
          {past
            .slice()
            .reverse()
            .map((e) => (
              <Card
                key={e.id}
                className="flex items-center justify-between gap-4 opacity-70"
              >
                <div className="min-w-0">
                  {isManager ? (
                    <Link
                      href={`/events/${e.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {e.title}
                    </Link>
                  ) : (
                    <span className="truncate font-medium">{e.title}</span>
                  )}
                  <div className="text-xs text-neutral-500">
                    {formatInTz(e.startAt, guild.timezone)} · {e._count.rsvps}{" "}
                    RSVPs
                  </div>
                </div>
                {canDelete ? (
                  <DeleteEventButton id={e.id} title={e.title} />
                ) : null}
              </Card>
            ))}
        </section>
      ) : null}
    </div>
  );
}
