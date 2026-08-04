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

/** An expected attendee of a meeting and what they've answered so far. */
export interface ExpectedAttendee {
  userId: string;
  status: "GOING" | "MOTIVATED" | null;
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

const STATUS_MARK: Record<string, string> = { GOING: "✅", MOTIVATED: "📝" };

/** Discord caps an embed field at 1024 characters. */
const FIELD_LIMIT = 1024;

function joinCapped(parts: string[]): string {
  const out: string[] = [];
  let length = 0;
  for (const [i, part] of parts.entries()) {
    // Leave room for the overflow hint rather than cutting mid-mention.
    if (length + part.length + 2 > FIELD_LIMIT - 16) {
      out.push(`+${parts.length - i} more`);
      break;
    }
    out.push(part);
    length += part.length + 2;
  }
  return out.join("  ");
}

/**
 * Roll-call for a meeting: everyone expected, marked with their answer. Events
 * are open to the whole server, so they get no such list.
 *
 * Mentions inside an embed render as names without notifying anyone, which is
 * what we want — the ping list is chosen separately on the schedule.
 */
function attendeeField(expected: ExpectedAttendee[]) {
  const waiting = expected.filter((a) => !a.status).length;
  return {
    name: `👥 Expected (${expected.length})${waiting ? ` · ${waiting} yet to answer` : ""}`,
    value: joinCapped(
      expected.map(
        (a) => `${a.status ? STATUS_MARK[a.status] : "▫️"} <@${a.userId}>`,
      ),
    ),
  };
}

export function buildEventEmbed(
  event: Event,
  counts: RsvpCounts,
  footer: string,
  expected: ExpectedAttendee[] = [],
): EmbedBuilder {
  const unix = Math.floor(event.startAt.getTime() / 1000);
  const detail: string[] = [`🗓️ <t:${unix}:F> · <t:${unix}:R>`];
  if (event.location) detail.push(`📍 ${event.location}`);
  if (event.url) detail.push(`🔗 ${event.url}`);

  const description = [event.description?.trim(), detail.join("\n")]
    .filter(Boolean)
    .join("\n\n");

  const embed = new EmbedBuilder()
    .setTitle(event.title)
    .setColor(KIND_COLORS[event.kind] ?? 0x209ebb)
    .setDescription(description)
    .addFields({
      name: "\u200b",
      value: `✅ **${counts.GOING}** going  ·  📝 **${counts.MOTIVATED}** motivation`,
    })
    .setFooter({ text: footer });

  if (event.kind === "MEETING" && expected.length > 0) {
    embed.addFields(attendeeField(expected));
  }
  return embed;
}

export function buildEventMessage(
  event: Event,
  counts: RsvpCounts,
  opts: {
    announcement?: boolean;
    leadLabel?: string | null;
    expected?: ExpectedAttendee[];
  },
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
    embeds: [buildEventEmbed(event, counts, footer, opts.expected)],
    components: [buildRsvpRow(event.id)],
    allowedMentions: allowedMentionsFor(mentions),
  };
}
