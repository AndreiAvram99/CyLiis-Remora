import type { APIEmbed, BaseMessageOptions } from "discord.js";
import type { Event } from "@repo/db";
import {
  allowedMentionsFor,
  buildEventEmbedPayload,
  buildEventMessagePayload,
  buildRsvpRowPayload,
  emptyRsvpCounts,
  type ExpectedAttendee,
  type RsvpCounts,
} from "@repo/shared";

export type { ExpectedAttendee, RsvpCounts };

export function emptyCounts(): RsvpCounts {
  return emptyRsvpCounts();
}

/**
 * The posts about a schedule are built in @repo/shared as plain API JSON, so
 * the dashboard can edit a message the worker sent — same embed, one place to
 * change it. These wrappers hand discord.js what it expects.
 */
export function buildRsvpRow(eventId: string) {
  return buildRsvpRowPayload(
    eventId,
  ) as unknown as NonNullable<BaseMessageOptions["components"]>[number];
}

export function buildEventEmbed(
  event: Event,
  counts: RsvpCounts,
  footer: string,
  expected: ExpectedAttendee[] = [],
): APIEmbed {
  return buildEventEmbedPayload(event, counts, footer, expected) as APIEmbed;
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
  const payload = buildEventMessagePayload(event, counts, opts);
  return {
    content: payload.content,
    embeds: payload.embeds as APIEmbed[],
    components: [buildRsvpRow(event.id)],
    allowedMentions: allowedMentionsFor({
      roleIds: event.mentionRoleIds,
      userIds: event.mentionUserIds,
      everyone: event.mentionEveryone,
    }),
  };
}
