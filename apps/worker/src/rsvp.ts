import { type ButtonInteraction, MessageFlags } from "discord.js";
import { prisma } from "@repo/db";
import { parseRsvpButtonId } from "@repo/shared";
import { buildEventEmbed, emptyCounts, type RsvpCounts } from "./messages.js";

export async function getRsvpCounts(eventId: string): Promise<RsvpCounts> {
  const grouped = await prisma.rsvp.groupBy({
    by: ["status"],
    where: { eventId },
    _count: { status: true },
  });
  const counts = emptyCounts();
  for (const g of grouped) {
    counts[g.status as keyof RsvpCounts] = g._count.status;
  }
  return counts;
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

  await prisma.rsvp.upsert({
    where: { eventId_userId: { eventId, userId: interaction.user.id } },
    create: {
      eventId,
      userId: interaction.user.id,
      username: interaction.user.username,
      status,
    },
    update: { status, username: interaction.user.username },
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
