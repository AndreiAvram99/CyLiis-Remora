import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
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
};
