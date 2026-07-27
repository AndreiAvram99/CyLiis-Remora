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
  // Optional comma-separated channel names to expose in the picker. Overrides
  // the built-in default list when set.
  channelAllowlist: () =>
    optional("CHANNEL_ALLOWLIST")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  googleCalendarEnabled: () =>
    optional("GOOGLE_CALENDAR_ENABLED", "true").toLowerCase() !== "false",
  googleCalendarId: () => optional("GOOGLE_CALENDAR_ID", "primary"),
  // Optional per-kind calendars. Fall back to GOOGLE_CALENDAR_ID when unset.
  googleCalendarIdMeeting: () => optional("GOOGLE_CALENDAR_ID_MEETING"),
  googleCalendarIdEvent: () => optional("GOOGLE_CALENDAR_ID_EVENT"),
  googleCalendarIdCustom: () => optional("GOOGLE_CALENDAR_ID_CUSTOM"),
  googleServiceAccountJson: () => optional("GOOGLE_SERVICE_ACCOUNT_JSON"),
  // Alternative to the inline JSON: an absolute path to the key file on disk.
  // Handy for local dev so the secret never lands in a checked-in file.
  googleServiceAccountFile: () =>
    optional("GOOGLE_SERVICE_ACCOUNT_FILE") ||
    optional("GOOGLE_APPLICATION_CREDENTIALS"),
};
