import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { DateTime } from "luxon";
import { prisma, RsvpStatus } from "@repo/db";
import { env } from "./env.js";

const SHARE_OPTION = "share";

const COMMANDS = [
  new SlashCommandBuilder()
    .setName("today")
    .setDescription("Everything scheduled for today")
    .addBooleanOption((o) =>
      o
        .setName(SHARE_OPTION)
        .setDescription("Post it for the whole channel instead of just you"),
    ),
  new SlashCommandBuilder()
    .setName("week")
    .setDescription("Everything scheduled for the next 7 days")
    .addBooleanOption((o) =>
      o
        .setName(SHARE_OPTION)
        .setDescription("Post it for the whole channel instead of just you"),
    ),
].map((c) => c.toJSON());

/**
 * Register as guild commands so they appear immediately instead of waiting on
 * Discord's global command propagation.
 */
export async function registerCommands(client: Client) {
  if (!client.application) return;
  try {
    await client.application.commands.set(COMMANDS, env.guildId());
    console.log("[bot] registered /today and /week");
  } catch (err) {
    console.error(
      '[bot] could not register slash commands. Re-invite the bot with the "applications.commands" scope.',
      err,
    );
  }
}

async function guildTimezone(): Promise<string> {
  const guild = await prisma.guild.findUnique({
    where: { id: env.guildId() },
    select: { timezone: true },
  });
  return guild?.timezone || env.timezone();
}

interface AgendaEvent {
  title: string;
  startAt: Date;
  allDay: boolean;
  location: string | null;
  invitees: { userId: string }[];
  rsvps: { status: RsvpStatus }[];
}

/**
 * Where the caller stands on this schedule. Being expected but silent is the
 * one case worth flagging, since that's what turns into a black mark.
 */
function callerNote(e: AgendaEvent, userId: string): string | null {
  const expected = e.invitees.some((i) => i.userId === userId);
  const status = e.rsvps[0]?.status;

  if (status === RsvpStatus.GOING) return "✅ You're going";
  if (status === RsvpStatus.MOTIVATED) return "📝 You're excused";
  if (expected) return "⚠️ You're expected — you haven't answered yet";
  return null;
}

function describe(e: AgendaEvent, userId: string, tz: string): string {
  const unix = Math.floor(e.startAt.getTime() / 1000);
  const when = e.allDay
    ? DateTime.fromJSDate(e.startAt).setZone(tz).toFormat("d LLL")
    : `<t:${unix}:t> · <t:${unix}:R>`;

  const lines = [`**${e.title}** — ${when}`];
  if (e.location) lines.push(`📍 ${e.location}`);
  const note = callerNote(e, userId);
  if (note) lines.push(note);

  return lines.join("\n　");
}

/** `/today` and `/week`: the caller's agenda, private unless they share it. */
export async function handleAgendaCommand(
  interaction: ChatInputCommandInteraction,
) {
  const week = interaction.commandName === "week";
  if (!week && interaction.commandName !== "today") return;

  const share = interaction.options.getBoolean(SHARE_OPTION) ?? false;
  const flags = share ? undefined : MessageFlags.Ephemeral;

  const tz = await guildTimezone();
  const now = DateTime.now().setZone(tz);
  // Today covers the whole day so a morning meeting still shows in the
  // afternoon; the week runs from right now.
  const from = week ? now : now.startOf("day");
  const to = week ? now.plus({ days: 7 }) : now.endOf("day");

  const events = await prisma.event.findMany({
    where: {
      guildId: env.guildId(),
      kind: { not: "PRINT" }, // print requests aren't scheduled work
      startAt: { gte: from.toJSDate(), lte: to.toJSDate() },
    },
    orderBy: { startAt: "asc" },
    take: 40,
    include: {
      invitees: { select: { userId: true } },
      rsvps: {
        where: { userId: interaction.user.id },
        select: { status: true },
      },
    },
  });

  if (events.length === 0) {
    await interaction.reply({
      content: week
        ? "Nothing scheduled for the next 7 days."
        : "Nothing scheduled today.",
      flags,
    });
    return;
  }

  let description: string;
  if (week) {
    // Day headings, so a week's worth of entries stays readable.
    const byDay = new Map<string, string[]>();
    for (const e of events) {
      const day = DateTime.fromJSDate(e.startAt)
        .setZone(tz)
        .toFormat("cccc, d LLL");
      byDay.set(day, [
        ...(byDay.get(day) ?? []),
        describe(e, interaction.user.id, tz),
      ]);
    }
    description = [...byDay]
      .map(([day, items]) => `__**${day}**__\n${items.join("\n\n")}`)
      .join("\n\n");
  } else {
    description = events
      .map((e) => describe(e, interaction.user.id, tz))
      .join("\n\n");
  }

  const embed = new EmbedBuilder()
    .setTitle(
      week ? "📆 Next 7 days" : `📆 Today · ${now.toFormat("cccc, d LLL")}`,
    )
    .setColor(0x209ebb)
    .setDescription(description.slice(0, 4000))
    .setFooter({
      text: share
        ? `Asked by ${interaction.user.username}`
        : "Only you can see this",
    });

  await interaction.reply({
    embeds: [embed],
    flags,
    allowedMentions: { parse: [] },
  });
}
