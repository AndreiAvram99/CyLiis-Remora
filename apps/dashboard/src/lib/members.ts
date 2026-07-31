import { prisma } from "@repo/db";
import { env } from "./env";

const API = "https://discord.com/api/v10";
const CDN = "https://cdn.discordapp.com";

/** membru-vechi and membru-nou. Override with ATTENDEE_ROLE_IDS. */
const DEFAULT_ATTENDEE_ROLE_IDS = [
  "1296135916431085690", // membru-vechi
  "1281010678253223967", // membru-nou
];

export function attendeeRoleIds(): string[] {
  const override = env.attendeeRoleIds();
  return override.length ? override : DEFAULT_ATTENDEE_ROLE_IDS;
}

interface RawMember {
  user?: {
    id: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
    bot?: boolean;
  };
  nick?: string | null;
  avatar?: string | null;
  roles?: string[];
}

/** Guild-specific avatar if the member set one, otherwise their global one. */
function avatarUrlOf(m: RawMember): string | null {
  const userId = m.user?.id;
  if (!userId) return null;
  if (m.avatar) {
    return `${CDN}/guilds/${env.guildId()}/users/${userId}/avatars/${m.avatar}.png?size=64`;
  }
  if (m.user?.avatar) {
    return `${CDN}/avatars/${userId}/${m.user.avatar}.png?size=64`;
  }
  return null;
}

/**
 * Pull the full roster from Discord and replace the local cache.
 *
 * Listing members is gated behind the privileged "Server Members Intent",
 * which must be enabled for the bot in the Developer Portal even for REST.
 */
export async function syncGuildMembers(): Promise<number> {
  const token = env.botToken();
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured.");
  const guildId = env.guildId();

  const rows: {
    id: string;
    guildId: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    roles: string[];
    isBot: boolean;
  }[] = [];

  let after = "0";
  // Discord caps a page at 1000; 20 pages covers any realistic guild here.
  for (let page = 0; page < 20; page++) {
    const res = await fetch(
      `${API}/guilds/${guildId}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${token}` } },
    );
    if (res.status === 403) {
      throw new Error(
        'Discord refused the member list. Enable "Server Members Intent" for the bot in the Developer Portal.',
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Discord member fetch failed (${res.status}). ${text.slice(0, 200)}`,
      );
    }

    const batch = (await res.json()) as RawMember[];
    if (!batch.length) break;

    for (const m of batch) {
      const user = m.user;
      if (!user?.id) continue;
      rows.push({
        id: user.id,
        guildId,
        username: user.username ?? null,
        displayName: m.nick || user.global_name || user.username || null,
        avatarUrl: avatarUrlOf(m),
        roles: m.roles ?? [],
        isBot: Boolean(user.bot),
      });
    }

    after = batch[batch.length - 1]?.user?.id ?? after;
    if (batch.length < 1000) break;
  }

  // The table is a cache, so a clean replace also prunes members who left.
  await prisma.$transaction([
    prisma.guildMember.deleteMany({ where: { guildId } }),
    prisma.guildMember.createMany({ data: rows, skipDuplicates: true }),
  ]);

  return rows.length;
}

const STALE_MS = 10 * 60 * 1000;

/** Refresh the roster when it's missing or stale. Never throws. */
export async function ensureGuildMembers(): Promise<void> {
  try {
    const newest = await prisma.guildMember.findFirst({
      where: { guildId: env.guildId() },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });
    if (newest && Date.now() - newest.updatedAt.getTime() < STALE_MS) return;
    await syncGuildMembers();
  } catch (err) {
    console.error("[members] roster sync failed:", err);
  }
}

export interface AttendeeCandidate {
  id: string;
  name: string;
  avatarUrl: string | null;
  roleIds: string[];
}

let cachedRoleNames: Map<string, string> | null = null;

/** Role id -> name, so groups are labelled with live Discord names. */
export async function fetchRoleNames(): Promise<Map<string, string>> {
  if (cachedRoleNames) return cachedRoleNames;
  const token = env.botToken();
  if (!token) return new Map();
  try {
    const res = await fetch(`${API}/guilds/${env.guildId()}/roles`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) return new Map();
    const roles = (await res.json()) as { id: string; name: string }[];
    cachedRoleNames = new Map(roles.map((r) => [r.id, r.name]));
    return cachedRoleNames;
  } catch {
    return new Map();
  }
}

/** Members eligible to be invited to a meeting, grouped by their role. */
export async function getAttendeeCandidates(): Promise<{
  groups: { roleId: string; roleName: string; members: AttendeeCandidate[] }[];
}> {
  await ensureGuildMembers();
  const roleIds = attendeeRoleIds();

  const members = await prisma.guildMember.findMany({
    where: {
      guildId: env.guildId(),
      isBot: false,
      roles: { hasSome: roleIds },
    },
    orderBy: { displayName: "asc" },
  });

  const roleNames = await fetchRoleNames();
  const groups = roleIds.map((roleId) => ({
    roleId,
    roleName: roleNames.get(roleId) ?? "members",
    members: members
      .filter((m) => m.roles.includes(roleId))
      .map((m) => ({
        id: m.id,
        name: m.displayName || m.username || m.id,
        avatarUrl: m.avatarUrl,
        roleIds: m.roles,
      })),
  }));

  return { groups: groups.filter((g) => g.members.length > 0) };
}
