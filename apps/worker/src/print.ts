import { MessageFlags, type ButtonInteraction } from "discord.js";
import { prisma } from "@repo/db";
import { buildPrintMessagePayload, parsePrintButtonId } from "@repo/shared";
import { resolveIdentity } from "./rsvp.js";

/**
 * Toggle who's taking care of a print request. Tapping when unclaimed marks you
 * as the printer; tapping again (as the same person) releases it. The original
 * message — including its file attachments — is edited in place to show state.
 */
export async function handlePrintClaim(interaction: ButtonInteraction) {
  const eventId = parsePrintButtonId(interaction.customId);
  if (!eventId) return;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    await interaction.reply({
      content: "This print request no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const mine = event.printClaimedById === interaction.user.id;
  let claimedById: string | null = null;
  let claimedByName: string | null = null;
  if (!mine) {
    const identity = await resolveIdentity(interaction);
    claimedById = interaction.user.id;
    claimedByName = identity.displayName;
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { printClaimedById: claimedById, printClaimedByName: claimedByName },
  });

  // Preserve the "Requested by" line from the existing embed.
  const requesterName =
    interaction.message.embeds[0]?.fields?.find(
      (f) => f.name === "Requested by",
    )?.value ?? null;

  const payload = buildPrintMessagePayload({
    eventId,
    title: event.title,
    description: event.description,
    requesterName,
    claimedByName,
    priority: event.printPriority,
    order: event.printOrder,
    status: event.printStatus,
  });

  try {
    await interaction.update({
      embeds: payload.embeds,
      components: payload.components,
    });
  } catch (err) {
    console.error("[print] failed to update message:", err);
    await interaction.reply({
      content: claimedByName
        ? "You're now taking care of this print."
        : "Released — it's up for grabs again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
