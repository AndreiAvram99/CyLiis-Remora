import { prisma, ReminderStatus, RsvpStatus } from "@repo/db";
import { Card } from "@/components/ui";
import { getGuild } from "@/lib/guild";
import { env } from "@/lib/env";
import { formatInTz } from "@/lib/time";

export const dynamic = "force-dynamic";

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs text-neutral-500">{sub}</div> : null}
    </Card>
  );
}

function RsvpBar({
  going,
  interested,
  no,
}: {
  going: number;
  interested: number;
  no: number;
}) {
  const total = going + interested + no || 1;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-800">
      <div
        className="bg-emerald-500"
        style={{ width: `${(going / total) * 100}%` }}
        title={`${going} going`}
      />
      <div
        className="bg-blue-500"
        style={{ width: `${(interested / total) * 100}%` }}
        title={`${interested} interested`}
      />
      <div
        className="bg-neutral-500"
        style={{ width: `${(no / total) * 100}%` }}
        title={`${no} can't`}
      />
    </div>
  );
}

export default async function AnalyticsPage() {
  const guild = await getGuild();

  const events = await prisma.event.findMany({
    where: { guildId: env.guildId() },
    orderBy: { startAt: "desc" },
    include: {
      rsvps: { select: { status: true } },
      reminders: { select: { status: true } },
    },
  });

  const totalEvents = events.length;
  const totalRsvps = events.reduce((sum, e) => sum + e.rsvps.length, 0);
  const totalReach = events.reduce(
    (sum, e) => sum + e.rsvps.length + e.interestedCount,
    0,
  );
  const avgEngagement =
    totalEvents === 0
      ? 0
      : Math.round(
          events.reduce(
            (sum, e) =>
              sum + pct(e.rsvps.length + e.interestedCount, guild.memberCount),
            0,
          ) / totalEvents,
        );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Outreach</h1>
        <p className="text-sm text-neutral-400">
          Engagement is measured against {guild.memberCount || "?"} server
          members.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Events" value={String(totalEvents)} />
        <StatCard label="Total RSVPs" value={String(totalRsvps)} />
        <StatCard
          label="Total reach"
          value={String(totalReach)}
          sub="RSVPs + Discord interested"
        />
        <StatCard
          label="Avg engagement"
          value={`${avgEngagement}%`}
          sub="of server members"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Per event
        </h2>
        {events.length === 0 ? (
          <Card className="text-sm text-neutral-400">No events yet.</Card>
        ) : (
          events.map((e) => {
            const going = e.rsvps.filter(
              (r) => r.status === RsvpStatus.GOING,
            ).length;
            const interested = e.rsvps.filter(
              (r) => r.status === RsvpStatus.INTERESTED,
            ).length;
            const no = e.rsvps.filter((r) => r.status === RsvpStatus.NO).length;
            const responders = e.rsvps.length;
            const reach = responders + e.interestedCount;
            const engagement = pct(reach, guild.memberCount);

            const sent = e.reminders.filter(
              (r) => r.status === ReminderStatus.SENT,
            ).length;
            const pending = e.reminders.filter(
              (r) => r.status === ReminderStatus.PENDING,
            ).length;
            const failed = e.reminders.filter(
              (r) => r.status === ReminderStatus.FAILED,
            ).length;

            return (
              <Card key={e.id} className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-neutral-500">
                    {formatInTz(e.startAt, guild.timezone)}
                  </div>
                </div>

                <RsvpBar going={going} interested={interested} no={no} />

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-400">
                  <span className="text-emerald-400">{going} going</span>
                  <span className="text-blue-400">{interested} interested</span>
                  <span className="text-neutral-400">{no} can&apos;t</span>
                  <span className="text-purple-300">
                    {e.interestedCount} Discord interested
                  </span>
                  <span className="ml-auto font-medium text-neutral-200">
                    {engagement}% reach
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-800 pt-2 text-xs text-neutral-500">
                  <span>Reminders:</span>
                  <span className="text-emerald-400">{sent} sent</span>
                  <span className="text-amber-400">{pending} pending</span>
                  {failed > 0 ? (
                    <span className="text-red-400">{failed} failed</span>
                  ) : null}
                </div>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
