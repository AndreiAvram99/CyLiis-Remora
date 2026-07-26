import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type BaseMessageOptions,
} from "discord.js";
import type { Event } from "@repo/db";
import { rsvpButtonId } from "@repo/shared";

const KIND_COLORS: Record<string, number> = {
  MEETING: 0x5865f2,
  EVENT: 0x57f287,
  CUSTOM: 0xeb459e,
};

export interface RsvpCounts {
  GOING: number;
  INTERESTED: number;
  NO: number;
}

export function emptyCounts(): RsvpCounts {
  return { GOING: 0, INTERESTED: 0, NO: 0 };
}

export function buildRsvpRow(eventId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(rsvpButtonId(eventId, "GOING"))
      .setLabel("Going")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(rsvpButtonId(eventId, "INTERESTED"))
      .setLabel("Interested")
      .setEmoji("⭐")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(rsvpButtonId(eventId, "NO"))
      .setLabel("Can't make it")
      .setEmoji("❌")
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
    .setColor(KIND_COLORS[event.kind] ?? 0x5865f2)
    .setDescription(description)
    .addFields({
      name: "\u200b",
      value: `✅ **${counts.GOING}** going  ·  ⭐ **${counts.INTERESTED}** interested  ·  ❌ **${counts.NO}** can't`,
    })
    .setFooter({ text: footer });
}

export function buildEventMessage(
  event: Event,
  counts: RsvpCounts,
  opts: { announcement?: boolean; leadLabel?: string | null },
): BaseMessageOptions {
  const unix = Math.floor(event.startAt.getTime() / 1000);
  const content = opts.announcement
    ? `📣 **New ${event.kind.toLowerCase()} scheduled**`
    : `⏰ **Reminder** — starts <t:${unix}:R>`;

  const footer = opts.announcement
    ? "React below so we can gauge interest"
    : (opts.leadLabel ?? "Reminder");

  return {
    content,
    embeds: [buildEventEmbed(event, counts, footer)],
    components: [buildRsvpRow(event.id)],
  };
}
