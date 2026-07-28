import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  botToken: () => required("DISCORD_BOT_TOKEN"),
  guildId: () => required("DISCORD_GUILD_ID"),
  timezone: () => process.env.DEFAULT_TIMEZONE ?? "Europe/Bucharest",
  pollSeconds: () => {
    const n = Number(process.env.REMINDER_POLL_SECONDS ?? "30");
    return Number.isFinite(n) && n > 0 ? n : 30;
  },
  // Where "Motivation" (excused-absence) reasons get posted. Prefer an explicit
  // channel id; otherwise the bot looks one up by name.
  apologyChannelId: () => process.env.APOLOGY_CHANNEL_ID?.trim() || null,
  apologyChannelName: () =>
    process.env.APOLOGY_CHANNEL_NAME?.trim() || "chat-de-scuze",

  // Google Calendar — mirrors the dashboard so spawned occurrences also sync.
  googleCalendarEnabled: () =>
    optional("GOOGLE_CALENDAR_ENABLED", "true").toLowerCase() !== "false",
  googleCalendarId: () => optional("GOOGLE_CALENDAR_ID", "primary"),
  googleCalendarIdMeeting: () => optional("GOOGLE_CALENDAR_ID_MEETING"),
  googleCalendarIdEvent: () => optional("GOOGLE_CALENDAR_ID_EVENT"),
  googleCalendarIdCustom: () => optional("GOOGLE_CALENDAR_ID_CUSTOM"),
  googleServiceAccountJson: () => optional("GOOGLE_SERVICE_ACCOUNT_JSON"),
  googleServiceAccountFile: () =>
    optional("GOOGLE_SERVICE_ACCOUNT_FILE") ||
    optional("GOOGLE_APPLICATION_CREDENTIALS"),
};
