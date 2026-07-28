import { MessageFlags, type ButtonInteraction } from "discord.js";
import { prisma } from "@repo/db";
import { buildPrintMessagePayload, parsePrintButtonId } from "@repo/shared";
import { resolveIdentity } from "./rsvp.js";

/**
 * Two-tap print flow driven by one button:
 *   1. Unclaimed → the tapper claims it and the request moves to Printing.
 *   2. Claimed   → the same person taps again to mark it Done for everyone.
 * The original message (with its file attachments) is edited in place so the
 * whole channel sees the current state.
 */
export async function handlePrintClaim(interaction: ButtonInteraction) {
  const eventId = parsePrintButtonId(interaction.customId);
  if (!eventId) return;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { printFiles: true },
  });
  if (!event) {
    await interaction.reply({
      content: "This print request no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (event.printStatus === "DONE") {
    await interaction.reply({
      content: "This print is already marked as done.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let claimedById = event.printClaimedById;
  let claimedByName = event.printClaimedByName;
  let status = event.printStatus;

  if (!claimedById) {
    // First tap: claim it and start printing.
    const identity = await resolveIdentity(interaction);
    claimedById = interaction.user.id;
    claimedByName = identity.displayName;
    status = "PRINTING";
  } else if (claimedById === interaction.user.id) {
    // Claimer's second tap: it's done.
    status = "DONE";
  } else {
    await interaction.reply({
      content: `**${event.printClaimedByName ?? "Someone else"}** is already printing this.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await prisma.event.update({
    where: { id: eventId },
    data: {
      printClaimedById: claimedById,
      printClaimedByName: claimedByName,
      printStatus: status,
    },
  });

  // Preserve the "Requested by" line from the existing embed.
  const requesterName =
    interaction.message.embeds[0]?.fields?.find(
      (f) => f.name === "Requested by",
    )?.value ?? null;

  const payload = buildPrintMessagePayload({
    eventId,
    files: event.printFiles.map((f) => ({
      name: f.name,
      order: f.order,
      copies: f.copies,
      filamentType: f.filamentType,
      infill: f.infill,
      wallCount: f.wallCount,
      color: f.color,
      needsSupport: f.needsSupport,
    })),
    description: event.description,
    requesterName,
    claimedByName,
    status,
  });

  try {
    await interaction.update({
      embeds: payload.embeds,
      components: payload.components,
    });
  } catch (err) {
    console.error("[print] failed to update message:", err);
    await interaction.reply({
      content:
        status === "DONE"
          ? "Marked as printed — thanks!"
          : "You're now taking care of this print.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
