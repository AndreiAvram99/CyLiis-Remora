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

export const env = {
  guildId: () => required("DISCORD_GUILD_ID"),
  discordClientId: () => required("DISCORD_CLIENT_ID"),
  discordClientSecret: () => required("DISCORD_CLIENT_SECRET"),
  botToken: () => optional("DISCORD_BOT_TOKEN"),
  defaultTimezone: () => optional("DEFAULT_TIMEZONE", "Europe/Bucharest"),
  adminDiscordIds: () =>
    optional("ADMIN_DISCORD_IDS")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  managerRoleIds: () =>
    optional("MANAGER_ROLE_ID")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  managerRoleName: () => optional("MANAGER_ROLE_NAME", "Remora-Admin"),
  // The single owner account: the only one that may delete schedules and
  // adjust members' marks. Other Remora-Admins keep full create/export access.
  masterDiscordId: () =>
    optional("MASTER_DISCORD_ID", "323893421402095617").trim(),
  // Optional comma-separated channel names to expose in the picker. Overrides
  // the built-in default list when set.
  channelAllowlist: () =>
    optional("CHANNEL_ALLOWLIST")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  // Roles whose members can be picked as expected meeting attendees.
  // Overrides the built-in membru-vechi / membru-nou pair when set.
  attendeeRoleIds: () =>
    optional("ATTENDEE_ROLE_IDS")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  // Instagram DM forwarding. Credentials come from the Meta App Dashboard
  // under Instagram > API setup with Instagram login (not the generic Meta app
  // id/secret). Forwarding stays off until the secret and channel are set.
  instagramAppSecret: () => optional("INSTAGRAM_APP_SECRET"),
  instagramVerifyToken: () => optional("INSTAGRAM_VERIFY_TOKEN"),
  instagramAccessToken: () => optional("INSTAGRAM_ACCESS_TOKEN"),
  instagramChannelId: () =>
    optional("INSTAGRAM_CHANNEL_ID", "1398623875402563726"),
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
  // General, …) that meeting agenda docs get filed into.
  googleAgendaFolderId: () =>
    optional(
      "GOOGLE_AGENDA_FOLDER_ID",
      "1k0hDa-pXW_wgdLPYhesMAsaPiVpZlhQ2",
    ).trim(),
  googleServiceAccountJson: () => optional("GOOGLE_SERVICE_ACCOUNT_JSON"),
  // Alternative to the inline JSON: an absolute path to the key file on disk.
  // Handy for local dev so the secret never lands in a checked-in file.
  googleServiceAccountFile: () =>
    optional("GOOGLE_SERVICE_ACCOUNT_FILE") ||
    optional("GOOGLE_APPLICATION_CREDENTIALS"),
};
