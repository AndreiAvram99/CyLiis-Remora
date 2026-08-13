function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

/** A comma-separated variable, trimmed and without the empty entries. */
function list(name: string): string[] {
  return optional(name)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Nothing here identifies a particular Discord server: every id, role and
 * folder comes from the environment, so this code runs for any guild that
 * supplies its own. Features whose ids are missing stay switched off rather
 * than falling back to someone else's server.
 */
export const env = {
  guildId: () => required("DISCORD_GUILD_ID"),
  discordClientId: () => required("DISCORD_CLIENT_ID"),
  discordClientSecret: () => required("DISCORD_CLIENT_SECRET"),
  botToken: () => optional("DISCORD_BOT_TOKEN"),
  defaultTimezone: () => optional("DEFAULT_TIMEZONE", "Europe/Bucharest"),
  adminDiscordIds: () => list("ADMIN_DISCORD_IDS"),
  managerRoleIds: () => list("MANAGER_ROLE_ID"),
  managerRoleName: () => optional("MANAGER_ROLE_NAME", "Remora-Admin"),
  // The single owner account: the only one that may delete schedules and
  // adjust members' marks. Other Remora-Admins keep full create/export access.
  // Unset means no owner, not everyone.
  masterDiscordId: () => optional("MASTER_DISCORD_ID").trim(),
  // Channel names to expose in the picker. Empty means every text channel the
  // bot can see.
  channelAllowlist: () =>
    list("CHANNEL_ALLOWLIST").map((s) => s.toLowerCase()),
  // Roles whose members can be picked as expected meeting attendees, by id and
  // by name. Empty means the picker offers no role shortcuts, only members.
  attendeeRoleIds: () => list("ATTENDEE_ROLE_IDS"),
  attendeeRoleNames: () =>
    list("ATTENDEE_ROLE_NAMES").map((s) => s.toLowerCase()),
  // Roles allowed to schedule into #announcements. Falls back to the role
  // named "Announcements" when unset.
  announcementsRoleIds: () => list("ANNOUNCEMENTS_ROLE_ID"),
  // Instagram DM forwarding. Credentials come from the Meta App Dashboard
  // under Instagram > API setup with Instagram login (not the generic Meta app
  // id/secret). Forwarding stays off until the secret and channel are set.
  instagramAppSecret: () => optional("INSTAGRAM_APP_SECRET"),
  instagramVerifyToken: () => optional("INSTAGRAM_VERIFY_TOKEN"),
  instagramAccessToken: () => optional("INSTAGRAM_ACCESS_TOKEN"),
  instagramChannelId: () => optional("INSTAGRAM_CHANNEL_ID").trim(),
  // Where this dashboard is reachable, for urls that outlive a request (e.g.
  // images embedded in Discord messages).
  publicUrl: () => optional("NEXTAUTH_URL").trim(),
  googleCalendarEnabled: () =>
    optional("GOOGLE_CALENDAR_ENABLED", "true").toLowerCase() !== "false",
  googleCalendarId: () => optional("GOOGLE_CALENDAR_ID", "primary"),
  // Optional per-kind calendars. Fall back to GOOGLE_CALENDAR_ID when unset.
  googleCalendarIdMeeting: () => optional("GOOGLE_CALENDAR_ID_MEETING"),
  googleCalendarIdEvent: () => optional("GOOGLE_CALENDAR_ID_EVENT"),
  googleCalendarIdCustom: () => optional("GOOGLE_CALENDAR_ID_CUSTOM"),
  // Drive folder holding the per-team minutes folders (Branding, Events,
  // General, …) that meeting agenda docs get filed into. Without it, agendas
  // can't be created.
  googleAgendaFolderId: () => optional("GOOGLE_AGENDA_FOLDER_ID").trim(),
  googleServiceAccountJson: () => optional("GOOGLE_SERVICE_ACCOUNT_JSON"),
  // Alternative to the inline JSON: an absolute path to the key file on disk.
  // Handy for local dev so the secret never lands in a checked-in file.
  googleServiceAccountFile: () =>
    optional("GOOGLE_SERVICE_ACCOUNT_FILE") ||
    optional("GOOGLE_APPLICATION_CREDENTIALS"),
};
