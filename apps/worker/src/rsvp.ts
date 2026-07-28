import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
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
import { buildEventEmbed, emptyCounts, type RsvpCounts } from "./messages.js";

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

/** The "Motivation" reason prompt shown when a member excuses their absence. */
function buildMotivationModal(eventId: string, title: string): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId(MOTIVATION_INPUT_ID)
    .setLabel("Why can't you make it?")
    .setPlaceholder("Add a short reason — it'll be posted for the team.")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  return new ModalBuilder()
    .setCustomId(motivationModalId(eventId))
    .setTitle(`Motivation — ${title}`.slice(0, 45))
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(input),
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

  // Responses close once it has started.
  if (event.startAt.getTime() <= Date.now()) {
    await interaction.reply({
      content: "This has already started — responses are closed.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // "Motivation" opens a modal so the member can explain their absence; the RSVP
  // is only recorded once they submit that form (see handleMotivationModal).
  if (status === "MOTIVATED") {
    await interaction.showModal(buildMotivationModal(eventId, event.title));
    return;
  }

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
    },
    // Switching away from "Motivation" clears any previous reason.
    update: {
      status,
      username: identity.username,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      note: null,
    },
  });

  const counts = await getRsvpCounts(eventId);
  const footer = interaction.message.embeds[0]?.footer?.text ?? "RSVP";

  try {
    await interaction.update({
      embeds: [buildEventEmbed(event, counts, footer)],
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

  // Responses close once it has started (in case the modal was opened earlier).
  if (event.startAt.getTime() <= Date.now()) {
    await interaction.reply({
      content: "This has already started — responses are closed.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const reason =
    interaction.fields.getTextInputValue(MOTIVATION_INPUT_ID).trim() ||
    "(no reason given)";

  const identity = await resolveIdentity(interaction);
  await prisma.rsvp.upsert({
    where: { eventId_userId: { eventId, userId: interaction.user.id } },
    create: {
      eventId,
      userId: interaction.user.id,
      username: identity.username,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      status: "MOTIVATED",
      note: reason,
    },
    update: {
      status: "MOTIVATED",
      username: identity.username,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      note: reason,
    },
  });

  // Refresh the counts on the original announcement/reminder message.
  const counts = await getRsvpCounts(eventId);
  if (interaction.isFromMessage()) {
    const footer = interaction.message.embeds[0]?.footer?.text ?? "RSVP";
    await interaction
      .update({ embeds: [buildEventEmbed(event, counts, footer)] })
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
async function postMotivation(
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
      .setDescription(`<@${interaction.user.id}> can't make it to **${eventTitle}**`)
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
