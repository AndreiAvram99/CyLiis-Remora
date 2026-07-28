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

/**
 * Post a message to a channel with file attachment(s) using the bot token.
 * Sent as multipart/form-data so the files are uploaded to Discord (which then
 * hosts them). Returns the created message id, or null.
 */
export async function postChannelMessageWithFiles(
  channelId: string,
  payload: Record<string, unknown>,
  files: { name: string; data: Buffer }[],
): Promise<string | null> {
  const token = env.botToken();
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured.");

  const form = new FormData();
  form.set("payload_json", JSON.stringify(payload));
  files.forEach((f, i) => {
    form.append(`files[${i}]`, new Blob([new Uint8Array(f.data)]), f.name);
  });

  const res = await fetch(`${API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Discord rejected the post (${res.status}). ${text.slice(0, 300)}`,
    );
  }
  const msg = (await res.json()) as { id?: string };
  return msg.id ?? null;
}

/** Post a plain (no-file) message to a channel via the bot. Returns message id. */
export async function postChannelMessage(
  channelId: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const token = env.botToken();
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured.");
  const res = await fetch(`${API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord post failed (${res.status}). ${text.slice(0, 300)}`);
  }
  const msg = (await res.json()) as { id?: string };
  return msg.id ?? null;
}

/** Edit an existing bot message in place (keeps its attachments). */
export async function editChannelMessage(
  channelId: string,
  messageId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const token = env.botToken();
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured.");
  const res = await fetch(
    `${API}/channels/${channelId}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord edit failed (${res.status}). ${text.slice(0, 300)}`);
  }
}

let cachedManagerRoleIds: string[] | null = null;

/**
 * The role id(s) that grant management access. Uses MANAGER_ROLE_ID if set,
 * otherwise resolves MANAGER_ROLE_NAME (default "Remora-Admin") to an id via
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
