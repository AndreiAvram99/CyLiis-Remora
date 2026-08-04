import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type BaseMessageOptions,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type ModalSubmitInteraction,
} from "discord.js";
import { DateTime } from "luxon";
import { prisma, RsvpStatus } from "@repo/db";
import { env } from "./env.js";
import {
  answerProblem,
  buildMotivationModal,
  motivationReason,
  postMotivation,
  recordRsvp,
  refreshEventPosts,
} from "./rsvp.js";

const SHARE_OPTION = "share";
const ALL_OPTION = "all";

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
    .setDescription("What you're expected at over the next 7 days")
    .addBooleanOption((o) =>
      o
        .setName(ALL_OPTION)
        .setDescription("Include meetings you're not expected at"),
    )
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

// Which agenda a button belongs to, so pressing it can redraw the same view.
// Kept to two characters because a custom id also carries the event id.
const SCOPES = {
  t: { week: false, all: true },
  w: { week: true, all: false },
  wa: { week: true, all: true },
} as const;

type Scope = keyof typeof SCOPES;

const BUTTON_PREFIX = "agenda";
const MODAL_PREFIX = "agendamotiv";

function isScope(value: string): value is Scope {
  return value in SCOPES;
}

function parseButtonId(customId: string) {
  const [prefix, scope, eventId, status] = customId.split(":");
  if (prefix !== BUTTON_PREFIX || !eventId || !scope || !isScope(scope)) {
    return null;
  }
  if (status !== "GOING" && status !== "MOTIVATED") return null;
  return { scope, eventId, status };
}

function parseModalId(customId: string) {
  const [prefix, scope, eventId] = customId.split(":");
  if (prefix !== MODAL_PREFIX || !eventId || !scope || !isScope(scope)) {
    return null;
  }
  return { scope, eventId };
}

async function guildTimezone(): Promise<string> {
  const guild = await prisma.guild.findUnique({
    where: { id: env.guildId() },
    select: { timezone: true },
  });
  return guild?.timezone || env.timezone();
}

interface AgendaEntry {
  id: string;
  title: string;
  kind: string;
  startAt: Date;
  allDay: boolean;
  location: string | null;
  /** Whether the caller may answer for this one. */
  answerable: boolean;
  status: RsvpStatus | null;
  expected: boolean;
}

async function loadEntries(
  userId: string,
  from: DateTime,
  to: DateTime,
): Promise<AgendaEntry[]> {
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
      rsvps: { where: { userId }, select: { status: true } },
    },
  });

  return events.map((e) => {
    // A meeting with a picked list belongs to those members only; everything
    // else is open to the whole server.
    const listed = e.invitees.some((i) => i.userId === userId);
    const restricted = e.kind === "MEETING" && e.invitees.length > 0;
    return {
      id: e.id,
      title: e.title,
      kind: e.kind,
      startAt: e.startAt,
      allDay: e.allDay,
      location: e.location,
      answerable: !restricted || listed,
      status: e.rsvps[0]?.status ?? null,
      expected: listed,
    };
  });
}

/**
 * Where the caller stands on this entry. Being expected but silent is the one
 * case worth flagging, since that's what turns into a black mark.
 */
function callerNote(e: AgendaEntry): string | null {
  if (e.status === RsvpStatus.GOING) return "✅ You're going";
  if (e.status === RsvpStatus.MOTIVATED) return "📝 You're excused";
  if (e.expected) return "⚠️ You're expected — you haven't answered yet";
  return null;
}

function describe(e: AgendaEntry, tz: string): string {
  const unix = Math.floor(e.startAt.getTime() / 1000);
  const when = e.allDay
    ? DateTime.fromJSDate(e.startAt).setZone(tz).toFormat("d LLL")
    : `<t:${unix}:t> · <t:${unix}:R>`;

  const lines = [`**${e.title}** — ${when}`];
  if (e.location) lines.push(`📍 ${e.location}`);
  const note = callerNote(e);
  if (note) lines.push(note);

  return lines.join("\n　");
}

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

// Discord allows five action rows per message, so only the soonest few entries
// get buttons; the rest stay answerable from their post in the channel.
const MAX_ROWS = 5;

/**
 * A Going/Motivation pair per entry the caller can still answer, so they never
 * have to go hunting for the original post. The current answer is highlighted.
 */
function answerRows(
  entries: AgendaEntry[],
  scope: Scope,
): ActionRowBuilder<ButtonBuilder>[] {
  const now = Date.now();
  return entries
    .filter((e) => e.answerable && e.startAt.getTime() > now)
    .slice(0, MAX_ROWS)
    .map((e) =>
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${BUTTON_PREFIX}:${scope}:${e.id}:GOING`)
          .setLabel(shorten(`Going · ${e.title}`, 60))
          .setEmoji("✅")
          .setStyle(
            e.status === RsvpStatus.GOING
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          ),
        new ButtonBuilder()
          .setCustomId(`${BUTTON_PREFIX}:${scope}:${e.id}:MOTIVATED`)
          .setLabel("Motivation")
          .setEmoji("📝")
          .setStyle(
            e.status === RsvpStatus.MOTIVATED
              ? ButtonStyle.Primary
              : ButtonStyle.Secondary,
          ),
      ),
    );
}

interface AgendaOptions {
  userId: string;
  scope: Scope;
  share: boolean;
  /** Only used for the footer of a shared post. */
  authorName?: string;
}

async function buildAgenda(o: AgendaOptions): Promise<BaseMessageOptions> {
  const { week, all } = SCOPES[o.scope];
  const tz = await guildTimezone();
  const now = DateTime.now().setZone(tz);
  // Today covers the whole day so a morning meeting still shows in the
  // afternoon; the week runs from right now.
  const from = week ? now : now.startOf("day");
  const to = week ? now.plus({ days: 7 }) : now.endOf("day");

  const loaded = await loadEntries(o.userId, from, to);
  // Filtered down to what concerns the caller, unless they asked for the lot.
  const entries = all ? loaded : loaded.filter((e) => e.answerable);

  if (entries.length === 0) {
    const nothing = week
      ? all
        ? "Nothing scheduled for the next 7 days."
        : "Nothing you're expected at over the next 7 days. Add `all: true` to see everything."
      : "Nothing scheduled today.";
    return { content: nothing, embeds: [], components: [] };
  }

  let description: string;
  if (week) {
    // Day headings, so a week's worth of entries stays readable.
    const byDay = new Map<string, string[]>();
    for (const e of entries) {
      const day = DateTime.fromJSDate(e.startAt)
        .setZone(tz)
        .toFormat("cccc, d LLL");
      byDay.set(day, [...(byDay.get(day) ?? []), describe(e, tz)]);
    }
    description = [...byDay]
      .map(([day, items]) => `__**${day}**__\n${items.join("\n\n")}`)
      .join("\n\n");
  } else {
    description = entries.map((e) => describe(e, tz)).join("\n\n");
  }

  const footer = [
    week && !all ? "Only what you're expected at" : null,
    o.share
      ? `Asked by ${o.authorName ?? "a member"}`
      : "Only you can see this",
  ]
    .filter(Boolean)
    .join(" · ");

  const embed = new EmbedBuilder()
    .setTitle(
      week ? "📆 Next 7 days" : `📆 Today · ${now.toFormat("cccc, d LLL")}`,
    )
    .setColor(0x209ebb)
    .setDescription(description.slice(0, 4000))
    .setFooter({ text: footer });

  return {
    content: "",
    embeds: [embed],
    // A shared post is public, so its buttons would answer for whoever taps
    // them while showing the asker's agenda. Keep them to the private view.
    components: o.share ? [] : answerRows(entries, o.scope),
    allowedMentions: { parse: [] },
  };
}

/** `/today` and `/week`: the caller's agenda, private unless they share it. */
export async function handleAgendaCommand(
  interaction: ChatInputCommandInteraction,
) {
  const week = interaction.commandName === "week";
  if (!week && interaction.commandName !== "today") return;

  const share = interaction.options.getBoolean(SHARE_OPTION) ?? false;
  const all = week
    ? (interaction.options.getBoolean(ALL_OPTION) ?? false)
    : true;
  const scope: Scope = !week ? "t" : all ? "wa" : "w";

  const payload = await buildAgenda({
    userId: interaction.user.id,
    scope,
    share,
    authorName: interaction.user.username,
  });

  await interaction.reply({
    ...payload,
    flags: share ? undefined : MessageFlags.Ephemeral,
  });
}

/** Answering straight from an agenda listing. */
export async function handleAgendaButton(interaction: ButtonInteraction) {
  const parsed = parseButtonId(interaction.customId);
  if (!parsed) return;

  const event = await prisma.event.findUnique({
    where: { id: parsed.eventId },
    select: { id: true, kind: true, title: true, startAt: true },
  });
  if (!event) {
    await interaction.reply({
      content: "This schedule no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const problem = await answerProblem(event, interaction.user.id);
  if (problem) {
    await interaction.reply({
      content: problem,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // A modal has to be the first response, so it can't wait behind any work.
  if (parsed.status === "MOTIVATED") {
    await interaction.showModal(
      buildMotivationModal(
        event.title,
        `${MODAL_PREFIX}:${parsed.scope}:${event.id}`,
      ),
    );
    return;
  }

  await interaction.deferUpdate();
  await recordRsvp(interaction, event.id, "GOING", null);
  await refreshEventPosts(interaction.client, event.id);
  await interaction.editReply(
    await buildAgenda({
      userId: interaction.user.id,
      scope: parsed.scope,
      share: false,
    }),
  );
}

/** The reason submitted for a "Motivation" tapped from an agenda listing. */
export async function handleAgendaMotivation(
  interaction: ModalSubmitInteraction,
) {
  const parsed = parseModalId(interaction.customId);
  if (!parsed) return;

  const event = await prisma.event.findUnique({
    where: { id: parsed.eventId },
    select: { id: true, kind: true, title: true, startAt: true },
  });
  if (!event) {
    await interaction.reply({
      content: "This schedule no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const problem = await answerProblem(event, interaction.user.id);
  if (problem) {
    await interaction.reply({
      content: problem,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const reason = motivationReason(interaction);
  const fromAgenda = interaction.isFromMessage();
  if (fromAgenda) await interaction.deferUpdate();
  else await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  await recordRsvp(interaction, event.id, "MOTIVATED", reason);
  const posted = await postMotivation(interaction, event.title, reason);
  await refreshEventPosts(interaction.client, event.id);

  if (fromAgenda) {
    await interaction.editReply(
      await buildAgenda({
        userId: interaction.user.id,
        scope: parsed.scope,
        share: false,
      }),
    );
    if (!posted) {
      await interaction
        .followUp({
          content:
            "Your motivation was recorded, but I couldn't find the channel to post it in.",
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => undefined);
    }
    return;
  }

  await interaction.editReply({
    content: posted
      ? "Thanks — your motivation was posted for the team."
      : "Your motivation was recorded, but I couldn't find the channel to post it in.",
  });
}
