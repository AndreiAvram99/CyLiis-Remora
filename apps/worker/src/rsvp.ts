import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Client,
  type Guild,
  type ModalSubmitInteraction,
} from "discord.js";
import { prisma } from "@repo/db";
import {
  MOTIVATION_INPUT_ID,
  motivationModalId,
  parseMotivationModalId,
  parseRsvpButtonId,
} from "@repo/shared";
import { env } from "./env.js";
import {
  buildEventEmbed,
  emptyCounts,
  type ExpectedAttendee,
  type RsvpCounts,
} from "./messages.js";

interface MemberIdentity {
  username: string;
  displayName: string;
  avatarUrl: string;
}

/**
 * Resolve the member's guild display name (nickname → global name → username)
 * and avatar. Falls back to the plain user if the member fetch fails.
 */
export async function resolveIdentity(
  interaction: ButtonInteraction | ModalSubmitInteraction,
): Promise<MemberIdentity> {
  const user = interaction.user;
  const identity: MemberIdentity = {
    username: user.username,
    displayName: user.globalName ?? user.username,
    avatarUrl: user.displayAvatarURL({ size: 64 }),
  };
  try {
    const guild =
      interaction.guild ??
      (await interaction.client.guilds.fetch(env.guildId()));
    const member = await guild.members.fetch(user.id);
    identity.displayName = member.displayName;
    identity.avatarUrl = member.displayAvatarURL({ size: 64 });
  } catch {
    // Keep the user-level fallback.
  }
  return identity;
}

export async function getRsvpCounts(eventId: string): Promise<RsvpCounts> {
  const grouped = await prisma.rsvp.groupBy({
    by: ["status"],
    where: { eventId },
    _count: { status: true },
  });
  const counts = emptyCounts();
  for (const g of grouped) {
    const key = g.status as keyof RsvpCounts;
    // Ignore any retired statuses (e.g. old "NO" rows).
    if (key in counts) counts[key] = g._count.status;
  }
  return counts;
}

/**
 * Who was picked as expected at a meeting, in the order shown on the dashboard,
 * each with the answer they've given so far. Empty for anything but a meeting,
 * since events are open to the whole server.
 */
export async function getExpectedAttendees(
  eventId: string,
  kind: string,
): Promise<ExpectedAttendee[]> {
  if (kind !== "MEETING") return [];

  const [invitees, answers] = await Promise.all([
    prisma.eventInvitee.findMany({
      where: { eventId },
      orderBy: { displayName: "asc" },
      select: { userId: true },
    }),
    prisma.rsvp.findMany({
      where: { eventId },
      select: { userId: true, status: true },
    }),
  ]);

  const answered = new Map(answers.map((a) => [a.userId, a.status]));
  return invitees.map((i) => {
    const status = answered.get(i.userId);
    return {
      userId: i.userId,
      status: status === "GOING" || status === "MOTIVATED" ? status : null,
    };
  });
}

const NOT_EXPECTED =
  "This meeting has a set attendee list and you're not on it, so there's nothing to answer. Ask a Remora-Admin to add you if that's wrong.";

/**
 * Whether the member is barred from answering. A meeting with a picked attendee
 * list only accepts answers from those members; events are open to the whole
 * server, and so is a meeting where nobody was picked.
 */
async function notExpected(
  event: { id: string; kind: string },
  userId: string,
): Promise<boolean> {
  if (event.kind !== "MEETING") return false;
  const invitees = await prisma.eventInvitee.findMany({
    where: { eventId: event.id },
    select: { userId: true },
  });
  if (invitees.length === 0) return false;
  return !invitees.some((i) => i.userId === userId);
}

/**
 * Why this member can't answer, or null when they can. Shared by every entry
 * point: the buttons under a post and the ones under an agenda command.
 */
export async function answerProblem(
  event: { id: string; kind: string; startAt: Date },
  userId: string,
): Promise<string | null> {
  if (event.startAt.getTime() <= Date.now()) {
    return "This has already started — responses are closed.";
  }
  if (await notExpected(event, userId)) return NOT_EXPECTED;
  return null;
}

/** Save an answer, snapshotting the member's guild name and avatar with it. */
export async function recordRsvp(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  eventId: string,
  status: "GOING" | "MOTIVATED",
  note: string | null,
): Promise<void> {
  const identity = await resolveIdentity(interaction);
  await prisma.rsvp.upsert({
    where: { eventId_userId: { eventId, userId: interaction.user.id } },
    create: {
      eventId,
      userId: interaction.user.id,
      username: identity.username,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      status,
      note,
    },
    // Switching away from "Motivation" clears any previous reason.
    update: {
      status,
      username: identity.username,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      note,
    },
  });
}

/**
 * Re-render every announcement and reminder already posted for the event. Needed
 * when an answer arrives from somewhere else — an agenda command, say — which
 * would otherwise leave those posts showing stale counts and roll-call.
 */
export async function refreshEventPosts(
  client: Client,
  eventId: string,
): Promise<void> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return;

  const posts = await prisma.reminder.findMany({
    where: { eventId, messageId: { not: null } },
    select: { channelId: true, messageId: true },
  });
  if (posts.length === 0) return;

  const counts = await getRsvpCounts(eventId);
  const expected = await getExpectedAttendees(eventId, event.kind);

  for (const post of posts) {
    if (!post.messageId) continue;
    try {
      const channel = await client.channels.fetch(
        post.channelId || event.channelId,
      );
      if (!channel?.isTextBased() || !("messages" in channel)) continue;
      const message = await channel.messages.fetch(post.messageId);
      const footer = message.embeds[0]?.footer?.text ?? "RSVP";
      await message.edit({
        embeds: [buildEventEmbed(event, counts, footer, expected)],
      });
    } catch (err) {
      console.error(`[rsvp] could not refresh post ${post.messageId}:`, err);
    }
  }
}

/** The "Motivation" reason prompt shown when a member excuses their absence. */
export function buildMotivationModal(
  title: string,
  customId: string,
): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId(MOTIVATION_INPUT_ID)
    .setLabel("Why can't you make it?")
    .setPlaceholder("Add a short reason — it'll be posted for the team.")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(`Motivation — ${title}`.slice(0, 45))
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(input),
    );
}

/** The reason typed into the modal, or a stand-in when it came back blank. */
export function motivationReason(interaction: ModalSubmitInteraction): string {
  return (
    interaction.fields.getTextInputValue(MOTIVATION_INPUT_ID).trim() ||
    "(no reason given)"
  );
}

export async function handleRsvpButton(interaction: ButtonInteraction) {
  const parsed = parseRsvpButtonId(interaction.customId);
  if (!parsed) return;
  const { eventId, status } = parsed;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    await interaction.reply({
      content: "This event no longer exists.",
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

  // "Motivation" opens a modal so the member can explain their absence; the RSVP
  // is only recorded once they submit that form (see handleMotivationModal).
  if (status === "MOTIVATED") {
    await interaction.showModal(
      buildMotivationModal(event.title, motivationModalId(eventId)),
    );
    return;
  }

  await recordRsvp(interaction, eventId, "GOING", null);

  const counts = await getRsvpCounts(eventId);
  const expected = await getExpectedAttendees(eventId, event.kind);
  const footer = interaction.message.embeds[0]?.footer?.text ?? "RSVP";

  try {
    await interaction.update({
      embeds: [buildEventEmbed(event, counts, footer, expected)],
    });
  } catch (err) {
    console.error("[rsvp] failed to update message:", err);
    await interaction.reply({
      content: `Recorded your RSVP: ${status.toLowerCase()}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

/** Handle the submitted "Motivation" modal: record it and post to the channel. */
export async function handleMotivationModal(
  interaction: ModalSubmitInteraction,
) {
  const eventId = parseMotivationModalId(interaction.customId);
  if (!eventId) return;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    await interaction.reply({
      content: "This event no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Re-checked here because the meeting can start, or the attendee list change,
  // while the modal sits open.
  const problem = await answerProblem(event, interaction.user.id);
  if (problem) {
    await interaction.reply({
      content: problem,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const reason = motivationReason(interaction);
  await recordRsvp(interaction, eventId, "MOTIVATED", reason);

  // Refresh the counts on the original announcement/reminder message.
  const counts = await getRsvpCounts(eventId);
  const expected = await getExpectedAttendees(eventId, event.kind);
  if (interaction.isFromMessage()) {
    const footer = interaction.message.embeds[0]?.footer?.text ?? "RSVP";
    await interaction
      .update({ embeds: [buildEventEmbed(event, counts, footer, expected)] })
      .catch((err) => console.error("[rsvp] modal update failed:", err));
  }

  const posted = await postMotivation(interaction, event.title, reason);

  await interaction
    .followUp({
      content: posted
        ? "Thanks — your motivation was posted for the team."
        : "Your motivation was recorded, but I couldn't find the channel to post it in.",
      flags: MessageFlags.Ephemeral,
    })
    .catch(() => undefined);
}

/** Post a member's absence reason to the configured apology channel. */
export async function postMotivation(
  interaction: ModalSubmitInteraction,
  eventTitle: string,
  reason: string,
): Promise<boolean> {
  try {
    const guild =
      interaction.guild ??
      (await interaction.client.guilds.fetch(env.guildId()));
    const channel = await resolveApologyChannel(guild);
    if (!channel) {
      console.error(
        `[rsvp] apology channel not found (id="${env.apologyChannelId() ?? ""}" name="${env.apologyChannelName()}")`,
      );
      return false;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffe201)
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setDescription(
        `<@${interaction.user.id}> can't make it to **${eventTitle}**`,
      )
      .addFields({ name: "Motivation", value: reason.slice(0, 1024) })
      .setTimestamp(new Date());

    await channel.send({ embeds: [embed] });
    return true;
  } catch (err) {
    console.error("[rsvp] failed to post motivation:", err);
    return false;
  }
}

/** Find the text channel where motivations should be posted. */
async function resolveApologyChannel(guild: Guild) {
  const id = env.apologyChannelId();
  if (id) {
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (channel?.isTextBased() && "send" in channel) return channel;
    return null;
  }

  const name = env.apologyChannelName().toLowerCase();
  const channels = await guild.channels.fetch();
  const match = channels.find(
    (c) => c?.isTextBased() && "send" in c && c.name.toLowerCase() === name,
  );
  return match && match.isTextBased() && "send" in match ? match : null;
}
