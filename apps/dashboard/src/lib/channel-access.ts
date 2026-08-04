import { prisma } from "@repo/db";
import { ensureGuildMembers } from "./members";
import { getSession, isMasterId } from "./session";

interface Restriction {
  /** What the user is missing, worded for an error message. */
  need: string;
  /** Holding any of these roles is enough. */
  roleIds?: string[];
  masterOnly?: boolean;
}

/**
 * Channels that aren't open to every manager. #announcements is the team's
 * megaphone, so scheduling into it takes the Announcements role, and
 * #andrei-fun is the owner's own channel. Everything else is unrestricted.
 */
const RESTRICTED: Record<string, Restriction> = {
  "1279013106621616128": {
    need: "the Announcements role",
    roleIds: ["1280868748097486888"],
  },
  "1514748130531213492": {
    need: "owner access",
    masterOnly: true,
  },
};

interface Poster {
  isMaster: boolean;
  roleIds: string[];
}

/**
 * The signed-in user's standing. Roles come from the cached roster rather than
 * the session so a role granted today takes effect without re-logging in.
 */
async function poster(): Promise<Poster> {
  const session = await getSession();
  const discordId = session?.user?.discordId;
  if (isMasterId(discordId)) return { isMaster: true, roleIds: [] };
  if (!discordId) return { isMaster: false, roleIds: [] };

  await ensureGuildMembers();
  const member = await prisma.guildMember.findUnique({
    where: { id: discordId },
    select: { roles: true },
  });
  return { isMaster: false, roleIds: member?.roles ?? [] };
}

function allowed(p: Poster, channelId: string): boolean {
  const rule = RESTRICTED[channelId];
  if (!rule) return true;
  if (p.isMaster) return true; // the owner posts anywhere
  if (rule.masterOnly) return false;
  return (rule.roleIds ?? []).some((r) => p.roleIds.includes(r));
}

/** Narrow a channel list to the ones the signed-in user may schedule into. */
export async function postableChannels<T extends { id: string }>(
  channels: T[],
): Promise<T[]> {
  const p = await poster();
  return channels.filter((c) => allowed(p, c.id));
}

/** Throws when the signed-in user may not schedule into this channel. */
export async function assertCanPostTo(channelId: string): Promise<void> {
  const p = await poster();
  if (allowed(p, channelId)) return;
  const rule = RESTRICTED[channelId];
  throw new Error(
    `You need ${rule?.need ?? "permission"} to schedule in that channel.`,
  );
}
