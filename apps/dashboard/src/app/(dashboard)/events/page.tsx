import Link from "next/link";
import { Plus, MapPin, Hash, Bell } from "lucide-react";
import { prisma, RsvpStatus } from "@repo/db";
import { Badge, Button, Card } from "@/components/ui";
import { getGuild } from "@/lib/guild";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { formatInTz, relativeTo } from "@/lib/time";
import { DeleteEventButton } from "./delete-button";

export const dynamic = "force-dynamic";

const KIND_STYLES: Record<string, string> = {
  MEETING: "bg-blue-500/15 text-blue-300",
  EVENT: "bg-emerald-500/15 text-emerald-300",
  CUSTOM: "bg-purple-500/15 text-purple-300",
};

export default async function EventsPage() {
  const guild = await getGuild();
  const session = await getSession();
  const isManager = Boolean(session?.user?.isManager);
  const now = new Date();

  const events = await prisma.event.findMany({
    where: { guildId: env.guildId() },
    orderBy: { startAt: "asc" },
    include: {
      reminders: true,
      _count: { select: { rsvps: true } },
      rsvps: { select: { status: true } },
    },
  });

  const channels = await prisma.channel.findMany({
    where: { guildId: env.guildId() },
    select: { id: true, name: true },
  });
  const channelName = new Map(channels.map((c) => [c.id, c.name]));

  const upcoming = events.filter((e) => e.startAt >= now);
  const past = events.filter((e) => e.startAt < now);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Events</h1>
          <p className="text-sm text-neutral-400">
            Times shown in {guild.timezone}.
          </p>
        </div>
        {isManager ? (
          <Link href="/events/new">
            <Button>
              <Plus size={16} /> New event
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
            const interested = e.rsvps.filter(
              (r) => r.status === RsvpStatus.INTERESTED,
            ).length;
            const pending = e.reminders.filter(
              (r) => r.status === "PENDING",
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
                    <span>
                      {going} going · {interested} interested
                    </span>
                  </div>
                </div>
                {isManager ? (
                  <div className="flex items-center gap-2">
                    <Link href={`/events/${e.id}`}>
                      <Button variant="secondary">Edit</Button>
                    </Link>
                    <DeleteEventButton id={e.id} title={e.title} />
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </section>

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
                    {formatInTz(e.startAt, guild.timezone)} ·{" "}
                    {e._count.rsvps} RSVPs
                  </div>
                </div>
                {isManager ? (
                  <DeleteEventButton id={e.id} title={e.title} />
                ) : null}
              </Card>
            ))}
        </section>
      ) : null}
    </div>
  );
}
