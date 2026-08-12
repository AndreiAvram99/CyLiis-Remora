import { prisma, RsvpStatus } from "@repo/db";
import { whiteCredit } from "@repo/shared";
import { env } from "./env";

export interface LeaderboardRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** Past meetings the member was listed as expected at. */
  expected: number;
  /** Of those, the ones they answered — turning up uninvited doesn't count. */
  going: number;
  motivated: number;
  /** Expected but never answered. */
  missed: number;
  /** missed + hand-added black marks. */
  black: number;
  /** Hand-added white marks. */
  white: number;
  /** Hand-added stars, each worth five white marks. */
  stars: number;
  /** black - white credit, used to rank by standing. */
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
  const starsByUser = new Map<string, number>();
  const snapshot = new Map<string, { name: string; avatarUrl: string | null }>();

  // Attendance is measured against what was asked of someone, so only meetings
  // they were expected at count. Answering one they weren't on the list for is
  // welcome, but it isn't attendance and can't push the rate past 100%.
  const invited = new Set(invitees.map((i) => `${i.eventId}:${i.userId}`));

  const answered = new Set<string>();
  for (const a of answers) {
    const key = `${a.eventId}:${a.userId}`;
    if (
      a.status !== RsvpStatus.GOING &&
      a.status !== RsvpStatus.MOTIVATED
    ) {
      continue;
    }
    answered.add(key);
    snapshot.set(a.userId, {
      name: a.displayName || a.username || a.userId,
      avatarUrl: a.avatarUrl,
    });
    if (!invited.has(key)) continue;
    bump(a.status === RsvpStatus.GOING ? going : motivated, a.userId);
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
    const target =
      m.kind === "WHITE"
        ? whiteByUser
        : m.kind === "STAR"
          ? starsByUser
          : blackByUser;
    bump(target, m.userId);
  }

  const userIds = [
    ...new Set([
      ...expected.keys(),
      ...going.keys(),
      ...motivated.keys(),
      ...blackByUser.keys(),
      ...whiteByUser.keys(),
      ...starsByUser.keys(),
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
    const stars = starsByUser.get(userId) ?? 0;
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
      stars,
      net: black - whiteCredit(white, stars),
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

/** Best standing first: stars lead, then white marks, and black marks trail. */
function byMarks(a: LeaderboardRow, b: LeaderboardRow): number {
  return (
    a.net - b.net ||
    b.stars - a.stars ||
    b.white - a.white ||
    a.black - b.black
  );
}

/** Showed up most, missed least. */
function byPresence(a: LeaderboardRow, b: LeaderboardRow): number {
  return b.going - a.going || a.missed - b.missed || b.motivated - a.motivated;
}

/**
 * Whichever column the board is ranked by, the other one settles ties — so
 * people level on marks are ordered by how often they turn up, and people with
 * the same attendance by their standing. Names only decide a true draw.
 */
export function sortRows(rows: LeaderboardRow[], sort: MarksSort) {
  const [first, second] =
    sort === "marks" ? [byMarks, byPresence] : [byPresence, byMarks];
  return [...rows].sort(
    (a, b) => first(a, b) || second(a, b) || a.name.localeCompare(b.name),
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
