import Link from "next/link";
import {
  Plus,
  Printer,
  Repeat,
  Video,
  CalendarDays,
  LayoutList,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@repo/db";
import { Button, Card } from "@/components/ui";
import { getGuild } from "@/lib/guild";
import { env } from "@/lib/env";
import { getSession, isMasterId } from "@/lib/session";
import { formatInTz } from "@/lib/time";
import { DeleteEventButton } from "./delete-button";
import { PrintCard } from "./print-card";
import { ScheduleCard } from "./schedule-card";

export const dynamic = "force-dynamic";

type View = "all" | "recurring" | "meetings" | "events" | "printing";

const VIEWS: { key: View; label: string; icon: LucideIcon; empty: string }[] = [
  { key: "all", label: "All", icon: LayoutList, empty: "Nothing scheduled." },
  {
    key: "recurring",
    label: "Repeating",
    icon: Repeat,
    empty: "No repeating meetings.",
  },
  {
    key: "meetings",
    label: "Meetings",
    icon: Video,
    empty: "No one-off meetings.",
  },
  { key: "events", label: "Events", icon: CalendarDays, empty: "No events." },
  {
    key: "printing",
    label: "Printing",
    icon: Printer,
    empty: "No print requests.",
  },
];

/** Which tab a schedule belongs to. Repeating meetings get their own bucket. */
function viewOf(e: { kind: string; recurrence: string }): View {
  if (e.kind === "PRINT") return "printing";
  if (e.kind !== "MEETING") return "events";
  return e.recurrence === "NONE" ? "meetings" : "recurring";
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const guild = await getGuild();
  const session = await getSession();
  const isManager = Boolean(session?.user?.isManager);
  const canDelete = isMasterId(session?.user?.discordId);
  const now = new Date();

  const { view } = await searchParams;
  const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0];
  const active = current.key;

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

  const dated = events.filter((e) => e.kind !== "PRINT");
  const inView = (e: (typeof events)[number]) =>
    active === "all" || viewOf(e) === active;
  const upcoming = dated.filter((e) => e.startAt >= now && inView(e));
  const past = dated.filter((e) => e.startAt < now && inView(e));

  // Tab counts show what's still waiting: schedules ahead, prints not done.
  const openPrints = printRequests.filter((e) => e.printStatus !== "DONE");
  const soon = dated.filter((e) => e.startAt >= now);
  const countFor = (key: View) => {
    if (key === "printing") return openPrints.length;
    if (key === "all") return soon.length + openPrints.length;
    return soon.filter((e) => viewOf(e) === key).length;
  };

  const showSchedules = active !== "printing";
  const showPrints =
    active === "printing" || (active === "all" && printRequests.length > 0);

  const guildId = env.guildId();
  const discordLink = (channelId: string, messageId: string) =>
    `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;

  return (
    <div className="space-y-8">
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

      <nav className="flex flex-wrap items-center gap-1">
        {VIEWS.map(({ key, label, icon: Icon }) => {
          const count = countFor(key);
          return (
            <Link
              key={key}
              href={key === "all" ? "/events" : `/events?view=${key}`}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
                active === key
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

      {showSchedules ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Upcoming ({upcoming.length})
          </h2>
          {upcoming.length === 0 ? (
            <Card className="text-sm text-neutral-400">
              {current.empty}
              {isManager ? " Create one to get started." : ""}
            </Card>
          ) : (
            upcoming.map((e) => (
              <ScheduleCard
                key={e.id}
                event={e}
                timezone={guild.timezone}
                channelName={channelName.get(e.channelId) ?? "unknown"}
                isManager={isManager}
                canDelete={canDelete}
              />
            ))
          )}
        </section>
      ) : null}

      {showPrints ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            <Printer size={14} /> Print requests ({printRequests.length})
          </h2>
          {printRequests.length === 0 ? (
            <Card className="text-sm text-neutral-400">{current.empty}</Card>
          ) : (
            printRequests.map((e) => (
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
            ))
          )}
        </section>
      ) : null}

      {showSchedules && past.length > 0 ? (
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
