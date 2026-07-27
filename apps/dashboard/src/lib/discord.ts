import { env } from "./env";

const API = "https://discord.com/api/v10";

export interface GuildMember {
  roles: string[];
}

/**
 * Fetch the caller's member object for our guild using their OAuth token.
 * Returns null if they are not a member (404) or the request fails. Requires
 * the `guilds.members.read` scope.
 */
export async function fetchGuildMember(
  accessToken: string,
): Promise<GuildMember | null> {
  try {
    const res = await fetch(
      `${API}/users/@me/guilds/${env.guildId()}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { roles?: string[] };
    return { roles: Array.isArray(data.roles) ? data.roles : [] };
  } catch {
    return null;
  }
}

let cachedManagerRoleIds: string[] | null = null;

/**
 * The role id(s) that grant management access. Uses MANAGER_ROLE_ID if set,
 * otherwise resolves MANAGER_ROLE_NAME (default "Remora") to an id via
 * the bot token. Cached for the process lifetime.
 */
export async function resolveManagerRoleIds(): Promise<string[]> {
  const explicit = env.managerRoleIds();
  if (explicit.length) return explicit;
  if (cachedManagerRoleIds) return cachedManagerRoleIds;

  const token = env.botToken();
  if (!token) return [];

  try {
    const res = await fetch(`${API}/guilds/${env.guildId()}/roles`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) return [];
    const roles = (await res.json()) as { id: string; name: string }[];
    const target = env.managerRoleName().toLowerCase();
    cachedManagerRoleIds = roles
      .filter((r) => r.name.toLowerCase() === target)
      .map((r) => r.id);
    return cachedManagerRoleIds;
  } catch {
    return [];
  }
}
