import { prisma } from "@repo/db";
import { PRINT_ONLY_CHANNELS } from "@repo/shared";
import { ensureGuildMembers, fetchRoleIdsByName } from "./members";
import { env } from "./env";
import { getSession, isMasterId } from "./session";

interface Restriction {
  /** What the user is missing, worded for an error message. */
  need: string;
  /** Holding a role of this name is enough, unless ids are pinned in env. */
  roleName: string;
  /** Ids pinned in the environment, which win over the name. */
  pinned: () => string[];
}

/**
 * Channels that aren't open to every manager, keyed by channel name so the rule
 * travels to any server that uses the same names. #announcements is the team's
 * megaphone, so scheduling into it takes the Announcements role. Everything
 * else in the picker is unrestricted.
 */
const RESTRICTED: Record<string, Restriction> = {
  announcements: {
    need: "the Announcements role",
    roleName: "announcements",
    pinned: () => env.announcementsRoleIds(),
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

function ruleFor(name?: string | null): Restriction | undefined {
  return name ? RESTRICTED[name.toLowerCase()] : undefined;
}

/** The roles that open a restricted channel: pinned ids, else the named role. */
async function gateRoleIds(rule: Restriction): Promise<string[]> {
  const pinned = rule.pinned();
  return pinned.length ? pinned : await fetchRoleIdsByName(rule.roleName);
}

async function allowed(p: Poster, name?: string | null): Promise<boolean> {
  const rule = ruleFor(name);
  if (!rule) return true;
  if (p.isMaster) return true; // the owner posts anywhere
  const gates = await gateRoleIds(rule);
  // An unresolvable gate keeps the channel shut rather than opening it to all.
  return gates.length > 0 && gates.some((r) => p.roleIds.includes(r));
}

/** Narrow a channel list to the ones the signed-in user may schedule into. */
export async function postableChannels<T extends { id: string; name: string }>(
  channels: T[],
): Promise<T[]> {
  const p = await poster();
  const verdicts = await Promise.all(channels.map((c) => allowed(p, c.name)));
  return channels.filter((_, i) => verdicts[i]);
}

/** Throws when the signed-in user may not schedule into this channel. */
export async function assertCanPostTo(channelId: string): Promise<void> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { name: true },
  });
  const p = await poster();
  if (await allowed(p, channel?.name)) return;
  throw new Error(
    `You need ${ruleFor(channel?.name)?.need ?? "permission"} to schedule in that channel.`,
  );
}

/** Throws when this kind of schedule doesn't belong in the channel. */
export async function assertKindAllowedIn(
  channelId: string,
  kind: string,
): Promise<void> {
  if (kind === "PRINT") return;
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { name: true },
  });
  const name = channel?.name.toLowerCase();
  if (name && PRINT_ONLY_CHANNELS.includes(name)) {
    throw new Error(`#${name} only takes print requests.`);
  }
}
