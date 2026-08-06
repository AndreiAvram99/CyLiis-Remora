import { Trophy } from "lucide-react";
import { Card } from "@/components/ui";
import { BlackMark, WhiteMark } from "@/components/marks";
import { getAttendeeCandidates } from "@/lib/members";
import {
  loadMarks,
  loadMemberMarks,
  sortRows,
  type MarksSort,
} from "@/lib/marks";
import { getGuild } from "@/lib/guild";
import { formatInTz } from "@/lib/time";
import { getSession, isMasterId, requireMember } from "@/lib/session";
import { MarksPanel } from "./marks-panel";
import { MemberMarks } from "./member-marks";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function MemberAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatarUrl}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-[10px] font-semibold text-neutral-300">
      {initials(name)}
    </span>
  );
}

/** Share of expected meetings the member actually showed up to. */
function rate(going: number, expected: number): string {
  if (expected === 0) return "—";
  return `${Math.round((going / expected) * 100)}%`;
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; member?: string }>;
}) {
  await requireMember();
  const session = await getSession();
  const isMaster = isMasterId(session?.user?.discordId);
  const guild = await getGuild();

  const { sort, member } = await searchParams;
  const active: MarksSort = sort === "marks" ? "marks" : "presence";

  const marks = await loadMarks();
  const rows = sortRows(marks.rows, active);

  // The owner can open one member to see where each of their marks came from.
  const detail = isMaster && member ? await loadMemberMarks(member) : null;
  const rowHref = (userId: string) =>
    `/leaderboard?sort=${active}${member === userId ? "" : `&member=${userId}`}`;

  // The owner can award a mark to anyone on the roster, not only past invitees.
  const roster = isMaster
    ? await getAttendeeCandidates()
    : { roles: [], members: [] };
  const rosterMembers = roster.members.map((m) => ({ id: m.id, name: m.name }));

  const tab = (key: MarksSort, label: string) => (
    <a
      href={`/leaderboard?sort=${key}`}
      className={`rounded-lg px-3 py-1.5 text-sm transition ${
        active === key
          ? "bg-neutral-800 font-medium text-neutral-100"
          : "text-neutral-400 hover:text-neutral-100"
      }`}
    >
      {label}
    </a>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight sm:text-[38px] sm:leading-tight">
          <Trophy size={28} className="text-palette-sun" />
          Leaderboard
        </h1>
        <p className="max-w-2xl text-sm text-neutral-500">
          Attendance at the meetings each member was expected at, across
          everything that has started. Black counts missed meetings plus
          anything added by hand; white counts credits.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {tab("presence", "Best attendance")}
        {tab("marks", "Most marks")}
      </div>

      {rows.length === 0 ? (
        <Card className="text-sm text-neutral-400">
          Nothing to rank yet. Once a meeting with expected attendees has
          started, everyone shows up here.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[rgb(var(--line))] text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-2 py-3 font-semibold">Member</th>
                <th className="px-2 py-3 text-right font-semibold">Going</th>
                <th className="px-2 py-3 text-right font-semibold">Motivated</th>
                <th className="px-2 py-3 text-right font-semibold">Missed</th>
                <th className="px-2 py-3 text-right font-semibold">Rate</th>
                <th className="px-4 py-3 text-right font-semibold">Marks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.userId}
                  className={`border-b border-[rgb(var(--line))] last:border-0 ${
                    member === r.userId ? "bg-neutral-800/60" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-neutral-600">{i + 1}</td>
                  <td className="px-2 py-3">
                    {isMaster ? (
                      <a
                        href={rowHref(r.userId)}
                        className="flex items-center gap-2 hover:underline"
                        title="See where their marks came from"
                      >
                        <MemberAvatar name={r.name} avatarUrl={r.avatarUrl} />
                        <span className="min-w-0 truncate">{r.name}</span>
                      </a>
                    ) : (
                      <span className="flex items-center gap-2">
                        <MemberAvatar name={r.name} avatarUrl={r.avatarUrl} />
                        <span className="min-w-0 truncate">{r.name}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right font-medium text-palette-azure">
                    {r.going}
                  </td>
                  <td className="px-2 py-3 text-right text-palette-sun">
                    {r.motivated}
                  </td>
                  <td className="px-2 py-3 text-right text-red-400">
                    {r.missed}
                  </td>
                  <td className="px-2 py-3 text-right text-neutral-400">
                    {rate(r.going, r.expected)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center justify-end gap-1.5">
                      {r.black > 0 ? <BlackMark count={r.black} /> : null}
                      {r.white > 0 ? <WhiteMark count={r.white} /> : null}
                      {r.black === 0 && r.white === 0 ? (
                        <span className="text-neutral-600">—</span>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {detail ? (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              {detail.name}&apos;s marks
            </h2>
            <a
              href={`/leaderboard?sort=${active}`}
              className="text-xs text-neutral-500 transition hover:text-neutral-200"
            >
              Close
            </a>
          </div>
          <MemberMarks
            userId={member!}
            name={detail.name}
            missed={detail.missed.map((m) => ({
              eventId: m.eventId,
              title: m.title,
              when: formatInTz(m.startAt, guild.timezone),
            }))}
            manual={detail.manual.map((m) => ({
              id: m.id,
              kind: m.kind,
              reason: m.reason,
              when: formatInTz(m.createdAt, guild.timezone),
            }))}
          />
        </Card>
      ) : null}

      {isMaster ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Adjust marks
          </h2>
          <MarksPanel members={rosterMembers} marks={marks.manual} />
          <p className="text-xs text-neutral-500">
            A black mark from a missed meeting isn&apos;t listed here — open the
            member in the table above to clear that one.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
