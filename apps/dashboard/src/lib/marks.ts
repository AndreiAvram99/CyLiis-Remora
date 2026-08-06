import { prisma, RsvpStatus } from "@repo/db";
import { env } from "./env";

export interface LeaderboardRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** Past meetings the member was listed as expected at. */
  expected: number;
  going: number;
  motivated: number;
  /** Expected but never answered. */
  missed: number;
  /** missed + hand-added black marks. */
  black: number;
  /** Hand-added white marks. */
  white: number;
  /** black - white, used to rank by standing. */
  net: number;
}

export interface ManualMark {
  id: string;
  userId: string;
  name: string;
  kind: string;
  reason: string | null;
  createdAt: Date;
}

export type MarksSort = "presence" | "marks";

/**
 * Attendance and marks per member, across every meeting that has started.
 *
 * Missed meetings are derived from RSVPs on read rather than stored, so a
 * manager correcting someone's status immediately clears the matching black
 * mark instead of leaving a stale record behind.
 */
export async function loadMarks(): Promise<{
  blackByUser: Map<string, number>;
  rows: LeaderboardRow[];
  manual: ManualMark[];
}> {
  const guildId = env.guildId();
  const scope = {
    guildId,
    kind: "MEETING" as const,
    startAt: { lt: new Date() },
  };

  const [invitees, answers, marks] = await Promise.all([
    prisma.eventInvitee.findMany({
      where: { event: scope },
      select: {
        userId: true,
        eventId: true,
        displayName: true,
        avatarUrl: true,
      },
    }),
    prisma.rsvp.findMany({
      where: { event: scope },
      select: {
        userId: true,
        eventId: true,
        status: true,
        displayName: true,
        username: true,
        avatarUrl: true,
      },
    }),
    prisma.memberMark.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const bump = (map: Map<string, number>, key: string) =>
    map.set(key, (map.get(key) ?? 0) + 1);

  const expected = new Map<string, number>();
  const going = new Map<string, number>();
  const motivated = new Map<string, number>();
  const missed = new Map<string, number>();
  const blackByUser = new Map<string, number>();
  const whiteByUser = new Map<string, number>();
  const snapshot = new Map<string, { name: string; avatarUrl: string | null }>();

  // Attendance counts every past meeting the member answered, whether or not
  // they were formally invited; "missed" only applies to expected attendees.
  const answered = new Set<string>();
  for (const a of answers) {
    if (a.status === RsvpStatus.GOING) bump(going, a.userId);
    else if (a.status === RsvpStatus.MOTIVATED) bump(motivated, a.userId);
    else continue;
    answered.add(`${a.eventId}:${a.userId}`);
    snapshot.set(a.userId, {
      name: a.displayName || a.username || a.userId,
      avatarUrl: a.avatarUrl,
    });
  }

  for (const i of invitees) {
    bump(expected, i.userId);
    if (!snapshot.has(i.userId)) {
      snapshot.set(i.userId, {
        name: i.displayName || i.userId,
        avatarUrl: i.avatarUrl,
      });
    }
    if (answered.has(`${i.eventId}:${i.userId}`)) continue;
    bump(missed, i.userId);
    bump(blackByUser, i.userId);
  }

  for (const m of marks) {
    bump(m.kind === "WHITE" ? whiteByUser : blackByUser, m.userId);
  }

  const userIds = [
    ...new Set([
      ...expected.keys(),
      ...going.keys(),
      ...motivated.keys(),
      ...blackByUser.keys(),
      ...whiteByUser.keys(),
    ]),
  ];

  // Prefer live roster names; fall back to whatever was snapshotted earlier.
  const members = await prisma.guildMember.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, username: true, avatarUrl: true },
  });
  const live = new Map(members.map((m) => [m.id, m]));
  const nameOf = (userId: string) =>
    live.get(userId)?.displayName ||
    live.get(userId)?.username ||
    snapshot.get(userId)?.name ||
    userId;
  const avatarOf = (userId: string) =>
    live.get(userId)?.avatarUrl ?? snapshot.get(userId)?.avatarUrl ?? null;

  const rows: LeaderboardRow[] = userIds.map((userId) => {
    const black = blackByUser.get(userId) ?? 0;
    const white = whiteByUser.get(userId) ?? 0;
    return {
      userId,
      name: nameOf(userId),
      avatarUrl: avatarOf(userId),
      expected: expected.get(userId) ?? 0,
      going: going.get(userId) ?? 0,
      motivated: motivated.get(userId) ?? 0,
      missed: missed.get(userId) ?? 0,
      black,
      white,
      net: black - white,
    };
  });

  return {
    blackByUser,
    rows,
    manual: marks.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: nameOf(m.userId),
      kind: m.kind,
      reason: m.reason,
      createdAt: m.createdAt,
    })),
  };
}

/**
 * Best attendance first, or best standing first when ranking by marks — white
 * marks lead, black marks trail, so the board reads as a credit list rather
 * than a wall of shame.
 */
export function sortRows(rows: LeaderboardRow[], sort: MarksSort) {
  return [...rows].sort((a, b) =>
    sort === "marks"
      ? a.net - b.net || b.white - a.white || a.name.localeCompare(b.name)
      : b.going - a.going ||
        a.missed - b.missed ||
        a.net - b.net ||
        a.name.localeCompare(b.name),
  );
}

/** A black mark a member picked up by not answering a meeting they were at. */
export interface MissedMeeting {
  eventId: string;
  title: string;
  startAt: Date;
}

export interface MemberMarkDetail {
  name: string;
  missed: MissedMeeting[];
  manual: ManualMark[];
}

/**
 * Where one member's marks come from, so the owner can take any of them back:
 * the meetings they were expected at and never answered, plus anything added
 * by hand.
 */
export async function loadMemberMarks(
  userId: string,
): Promise<MemberMarkDetail | null> {
  const guildId = env.guildId();

  const [invitations, answers, manual, member] = await Promise.all([
    prisma.eventInvitee.findMany({
      where: {
        userId,
        event: { guildId, kind: "MEETING", startAt: { lt: new Date() } },
      },
      select: {
        displayName: true,
        event: { select: { id: true, title: true, startAt: true } },
      },
    }),
    prisma.rsvp.findMany({
      where: { userId, event: { guildId } },
      select: { eventId: true, status: true, displayName: true },
    }),
    prisma.memberMark.findMany({
      where: { guildId, userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.guildMember.findUnique({
      where: { id: userId },
      select: { displayName: true, username: true },
    }),
  ]);

  if (invitations.length === 0 && manual.length === 0) return null;

  const answered = new Set(
    answers
      .filter(
        (a) =>
          a.status === RsvpStatus.GOING || a.status === RsvpStatus.MOTIVATED,
      )
      .map((a) => a.eventId),
  );

  const name =
    member?.displayName ||
    member?.username ||
    invitations[0]?.displayName ||
    answers[0]?.displayName ||
    userId;

  return {
    name,
    missed: invitations
      .filter((i) => !answered.has(i.event.id))
      .map((i) => ({
        eventId: i.event.id,
        title: i.event.title,
        startAt: i.event.startAt,
      }))
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime()),
    manual: manual.map((m) => ({
      id: m.id,
      userId: m.userId,
      name,
      kind: m.kind,
      reason: m.reason,
      createdAt: m.createdAt,
    })),
  };
}
