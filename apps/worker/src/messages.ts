import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type BaseMessageOptions,
} from "discord.js";
import type { Event } from "@repo/db";
import { allowedMentionsFor, mentionPrefix, rsvpButtonId } from "@repo/shared";

const KIND_COLORS: Record<string, number> = {
  MEETING: 0x209ebb,
  EVENT: 0xffb701,
  CUSTOM: 0xfc8500,
};

export interface RsvpCounts {
  GOING: number;
  MOTIVATED: number;
}

export function emptyCounts(): RsvpCounts {
  return { GOING: 0, MOTIVATED: 0 };
}

export function buildRsvpRow(eventId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(rsvpButtonId(eventId, "GOING"))
      .setLabel("Going")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(rsvpButtonId(eventId, "MOTIVATED"))
      .setLabel("Motivation")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Secondary),
  );
}

export function buildEventEmbed(
  event: Event,
  counts: RsvpCounts,
  footer: string,
): EmbedBuilder {
  const unix = Math.floor(event.startAt.getTime() / 1000);
  const detail: string[] = [`🗓️ <t:${unix}:F> · <t:${unix}:R>`];
  if (event.location) detail.push(`📍 ${event.location}`);
  if (event.url) detail.push(`🔗 ${event.url}`);

  const description = [event.description?.trim(), detail.join("\n")]
    .filter(Boolean)
    .join("\n\n");

  return new EmbedBuilder()
    .setTitle(event.title)
    .setColor(KIND_COLORS[event.kind] ?? 0x209ebb)
    .setDescription(description)
    .addFields({
      name: "\u200b",
      value: `✅ **${counts.GOING}** going  ·  📝 **${counts.MOTIVATED}** motivation`,
    })
    .setFooter({ text: footer });
}

export function buildEventMessage(
  event: Event,
  counts: RsvpCounts,
  opts: { announcement?: boolean; leadLabel?: string | null },
): BaseMessageOptions {
  const unix = Math.floor(event.startAt.getTime() / 1000);
  const headline = opts.announcement
    ? `📣 **New ${event.kind.toLowerCase()} scheduled**`
    : `⏰ **Reminder** — starts <t:${unix}:R>`;

  const footer = opts.announcement
    ? "React below so we can gauge interest"
    : (opts.leadLabel ?? "Reminder");

  // Whoever the schedule was tagged with gets pinged on every post for it.
  const mentions = {
    roleIds: event.mentionRoleIds,
    userIds: event.mentionUserIds,
    everyone: event.mentionEveryone,
  };
  const ping = mentionPrefix(mentions);

  return {
    content: ping ? `${ping}\n${headline}` : headline,
    embeds: [buildEventEmbed(event, counts, footer)],
    components: [buildRsvpRow(event.id)],
    allowedMentions: allowedMentionsFor(mentions),
  };
}
