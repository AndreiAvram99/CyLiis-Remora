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
  defaultTimezone: () => optional("DEFAULT_TIMEZONE", "Europe/Bucharest"),
  adminDiscordIds: () =>
    optional("ADMIN_DISCORD_IDS")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  googleCalendarEnabled: () =>
    optional("GOOGLE_CALENDAR_ENABLED", "true").toLowerCase() !== "false",
  googleCalendarId: () => optional("GOOGLE_CALENDAR_ID", "primary"),
  googleServiceAccountJson: () => optional("GOOGLE_SERVICE_ACCOUNT_JSON"),
};
