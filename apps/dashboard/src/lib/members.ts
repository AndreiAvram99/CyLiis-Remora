import { prisma } from "@repo/db";
import { env } from "./env";

const API = "https://discord.com/api/v10";
const CDN = "https://cdn.discordapp.com";

/**
 * Roles a meeting can invite from, in the order they're offered. Which ones
 * belongs to the server, not to this code: pin them with ATTENDEE_ROLE_IDS,
 * or name them with ATTENDEE_ROLE_NAMES if you'd rather survive renames of the
 * ids than of the names.
 */
export function attendeeRoleIds(): string[] {
  return env.attendeeRoleIds();
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

/** Animated avatars are only served as gifs; asking for png returns nothing. */
function avatarExt(hash: string): string {
  return hash.startsWith("a_") ? "gif" : "png";
}

/** Guild-specific avatar if the member set one, otherwise their global one. */
function avatarUrlOf(m: RawMember): string | null {
  const userId = m.user?.id;
  if (!userId) return null;
  if (m.avatar) {
    return `${CDN}/guilds/${env.guildId()}/users/${userId}/avatars/${m.avatar}.${avatarExt(m.avatar)}?size=64`;
  }
  if (m.user?.avatar) {
    return `${CDN}/avatars/${userId}/${m.user.avatar}.${avatarExt(m.user.avatar)}?size=64`;
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

export interface MemberIdentity {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/** Live roster identity for the given members, keyed by Discord id. */
export async function rosterIdentities(
  userIds: string[],
): Promise<Map<string, MemberIdentity>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const members = await prisma.guildMember.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  });
  return new Map(
    members.map((m) => [
      m.id,
      {
        username: m.username,
        displayName: m.displayName,
        avatarUrl: m.avatarUrl,
      },
    ]),
  );
}

/**
 * The picture Discord serves for a member right now. A sign-in token can be
 * weeks old and an avatar url names the picture's hash, so what was captured at
 * login stops resolving the moment they change it; the roster knows better.
 */
export async function currentAvatarUrl(
  userId: string | undefined,
  fallback?: string | null,
): Promise<string | null> {
  if (!userId) return fallback ?? null;
  await ensureGuildMembers();
  const roster = await rosterIdentities([userId]);
  return roster.get(userId)?.avatarUrl ?? fallback ?? null;
}

interface Named {
  userId: string;
  username?: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
}

/**
 * Bring the names and avatars on an event's answers up to date.
 *
 * Rsvp and EventInvitee keep a snapshot from the moment someone answered, and a
 * Discord avatar url names the picture's own hash — so the snapshot points at a
 * picture that no longer exists as soon as they change it. The roster is the
 * current truth and wins wherever it knows the member; snapshots stay as the
 * fallback, which is what keeps people who have since left the server visible.
 */
export async function fillIdentities(
  events: { rsvps: Named[]; invitees: Named[] }[],
): Promise<void> {
  const everyone = events.flatMap((e) =>
    [...e.rsvps, ...e.invitees].map((p) => p.userId),
  );
  if (everyone.length === 0) return;

  await ensureGuildMembers();
  const roster = await rosterIdentities(everyone);
  for (const e of events) {
    const invited = new Map(e.invitees.map((i) => [i.userId, i]));
    for (const r of e.rsvps) {
      const live = roster.get(r.userId);
      const snapshot = invited.get(r.userId);
      r.username = live?.username ?? r.username ?? null;
      r.displayName =
        live?.displayName ?? r.displayName ?? snapshot?.displayName ?? null;
      r.avatarUrl = live?.avatarUrl ?? r.avatarUrl ?? null;
    }
    for (const i of e.invitees) {
      const live = roster.get(i.userId);
      i.displayName = live?.displayName ?? i.displayName ?? null;
      i.avatarUrl = live?.avatarUrl ?? i.avatarUrl ?? null;
    }
  }
}

export interface AttendeeCandidate {
  id: string;
  name: string;
  avatarUrl: string | null;
  roleIds: string[];
}

interface RawRole {
  id: string;
  name: string;
  position: number;
  managed?: boolean;
}

let cachedRoles: RawRole[] | null = null;

async function fetchGuildRoles(): Promise<RawRole[]> {
  if (cachedRoles) return cachedRoles;
  const token = env.botToken();
  if (!token) return [];
  try {
    const res = await fetch(`${API}/guilds/${env.guildId()}/roles`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) return [];
    cachedRoles = (await res.json()) as RawRole[];
    return cachedRoles;
  } catch {
    return [];
  }
}

/** Role id -> name, so groups are labelled with live Discord names. */
export async function fetchRoleNames(): Promise<Map<string, string>> {
  const roles = await fetchGuildRoles();
  return new Map(roles.map((r) => [r.id, r.name]));
}

/**
 * Every role going by this name. Lets a rule be written against a name the
 * server chooses ("Announcements") instead of an id baked into the code.
 */
export async function fetchRoleIdsByName(name: string): Promise<string[]> {
  const wanted = name.toLowerCase();
  const roles = await fetchGuildRoles();
  return roles.filter((r) => r.name.toLowerCase() === wanted).map((r) => r.id);
}

export interface MentionOptions {
  roles: { id: string; name: string }[];
  members: { id: string; name: string; avatarUrl: string | null }[];
}

/**
 * Everything the schedule form can ping: the guild's own roles, highest first,
 * and every human member. Excludes @everyone (offered separately) and the roles
 * Discord manages for bots and integrations, which nobody wants to tag.
 */
export async function getMentionOptions(): Promise<MentionOptions> {
  await ensureGuildMembers();

  const [roles, members] = await Promise.all([
    fetchGuildRoles(),
    prisma.guildMember.findMany({
      where: { guildId: env.guildId(), isBot: false },
      orderBy: { displayName: "asc" },
    }),
  ]);

  return {
    roles: roles
      .filter((r) => r.id !== env.guildId() && !r.managed)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name })),
    members: members.map((m) => ({
      id: m.id,
      name: m.displayName || m.username || m.id,
      avatarUrl: m.avatarUrl,
    })),
  };
}

/**
 * The roles a meeting can invite from, in offer order: the pinned ids first,
 * then any extra matched by name. Names that no longer exist are dropped.
 */
async function attendeeRoles(): Promise<{ id: string; name: string }[]> {
  const roles = await fetchGuildRoles();
  const byId = new Map(roles.map((r) => [r.id, r.name]));

  const wanted = attendeeRoleIds().map((id) => ({
    id,
    name: byId.get(id) ?? "members",
  }));

  const taken = new Set(wanted.map((r) => r.id));
  for (const name of env.attendeeRoleNames()) {
    const match = roles.find(
      (r) => r.name.toLowerCase() === name && !taken.has(r.id),
    );
    if (match) wanted.push({ id: match.id, name: match.name });
  }
  return wanted;
}

export interface AttendeeRoster {
  /** Shortcuts for inviting a whole team at once. */
  roles: { id: string; name: string; memberIds: string[] }[];
  /** Everyone in the guild, each listed once — mentors and guests included. */
  members: AttendeeCandidate[];
}

/** Who can be invited to a meeting, plus the roles that pick them in bulk. */
export async function getAttendeeCandidates(): Promise<AttendeeRoster> {
  await ensureGuildMembers();
  const roles = await attendeeRoles();

  const rows = await prisma.guildMember.findMany({
    where: { guildId: env.guildId(), isBot: false },
  });

  const members = rows
    .map((m) => ({
      id: m.id,
      name: m.displayName || m.username || m.id,
      avatarUrl: m.avatarUrl,
      roleIds: m.roles,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    roles: roles
      .map((role) => ({
        id: role.id,
        name: role.name,
        memberIds: members
          .filter((m) => m.roleIds.includes(role.id))
          .map((m) => m.id),
      }))
      .filter((r) => r.memberIds.length > 0),
    members,
  };
}
