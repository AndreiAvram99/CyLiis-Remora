import { prisma, RsvpStatus } from "@repo/db";
import { env } from "./env";

export interface MarkEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** Missed meetings plus any hand-added black marks. */
  black: number;
  /** Hand-added white marks. */
  white: number;
  /** black - white, used to order the leaderboard. */
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

/**
 * Marks per member, combining the black marks derived from missed meetings
 * with the ones awarded by hand.
 *
 * Missed meetings are computed on read rather than stored, so a manager
 * correcting someone's RSVP immediately clears the matching mark instead of
 * leaving a stale record behind.
 */
export async function countMarks(): Promise<{
  blackByUser: Map<string, number>;
  whiteByUser: Map<string, number>;
  ranking: MarkEntry[];
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
      where: {
        event: scope,
        status: { in: [RsvpStatus.GOING, RsvpStatus.MOTIVATED] },
      },
      select: { userId: true, eventId: true },
    }),
    prisma.memberMark.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const answered = new Set(answers.map((a) => `${a.eventId}:${a.userId}`));
  const blackByUser = new Map<string, number>();
  const whiteByUser = new Map<string, number>();
  const snapshot = new Map<string, { name: string; avatarUrl: string | null }>();

  for (const i of invitees) {
    snapshot.set(i.userId, {
      name: i.displayName || i.userId,
      avatarUrl: i.avatarUrl,
    });
    if (answered.has(`${i.eventId}:${i.userId}`)) continue;
    blackByUser.set(i.userId, (blackByUser.get(i.userId) ?? 0) + 1);
  }

  for (const m of marks) {
    const target = m.kind === "WHITE" ? whiteByUser : blackByUser;
    target.set(m.userId, (target.get(m.userId) ?? 0) + 1);
  }

  // Prefer live roster names; fall back to whatever was snapshotted on invite.
  const userIds = [
    ...new Set([...blackByUser.keys(), ...whiteByUser.keys()]),
  ];
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

  const ranking = userIds
    .map((userId) => {
      const black = blackByUser.get(userId) ?? 0;
      const white = whiteByUser.get(userId) ?? 0;
      return {
        userId,
        black,
        white,
        net: black - white,
        name: nameOf(userId),
        avatarUrl: avatarOf(userId),
      };
    })
    .sort(
      (a, b) => b.net - a.net || b.black - a.black || a.name.localeCompare(b.name),
    );

  return {
    blackByUser,
    whiteByUser,
    ranking,
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
