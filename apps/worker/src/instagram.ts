import { MessageFlags, type ButtonInteraction } from "discord.js";
import { prisma } from "@repo/db";
import {
  buildInstagramMessagePayload,
  parseInstagramReadButtonId,
} from "@repo/shared";
import { resolveIdentity } from "./rsvp.js";

/**
 * "Mark as read" on a forwarded Instagram DM: records who picked it up and
 * edits the message in place so the channel can see the DM is handled. First
 * tap wins — a second person tapping just gets told who got there first.
 */
export async function handleInstagramRead(interaction: ButtonInteraction) {
  const id = parseInstagramReadButtonId(interaction.customId);
  if (!id) return;

  const row = await prisma.instagramMessage.findUnique({ where: { id } });
  if (!row) {
    await interaction.reply({
      content: "This message is no longer tracked.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (row.readById) {
    await interaction.reply({
      content: `**${row.readByName ?? "Someone"}** already marked this as read.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const identity = await resolveIdentity(interaction);
  const updated = await prisma.instagramMessage.update({
    where: { id },
    data: {
      readById: interaction.user.id,
      readByName: identity.displayName,
      readAt: new Date(),
    },
  });

  const payload = buildInstagramMessagePayload({
    id: updated.id,
    author: updated.senderHandle ?? "Instagram user",
    authorIcon: updated.senderAvatar,
    text: updated.text,
    imageUrl: updated.imageUrl,
    attachments: updated.attachments,
    sentAt: updated.sentAt,
    readByName: updated.readByName,
    readAt: updated.readAt,
  });

  try {
    await interaction.update({
      embeds: payload.embeds,
      components: payload.components,
    });
  } catch (err) {
    console.error("[instagram] failed to update message:", err);
    await interaction.reply({
      content: "Marked as read — thanks!",
      flags: MessageFlags.Ephemeral,
    });
  }
}
