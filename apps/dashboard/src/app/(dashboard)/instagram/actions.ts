"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { buildInstagramMessagePayload } from "@repo/shared";
import { deleteChannelMessage, editChannelMessage } from "@/lib/discord";
import { assertMaster } from "@/lib/session";

/**
 * Mark a DM as read from the dashboard. The Discord post is edited to match, so
 * the channel and the tab never disagree about who picked a message up.
 */
export async function markMessageRead(id: string) {
  const session = await assertMaster();

  const row = await prisma.instagramMessage.findUnique({ where: { id } });
  if (!row || row.readById) return;

  const updated = await prisma.instagramMessage.update({
    where: { id },
    data: {
      readById: session?.user?.discordId ?? "master",
      readByName: session?.user?.name ?? "Master",
      readAt: new Date(),
    },
  });

  if (updated.channelId && updated.messageId) {
    const payload = buildInstagramMessagePayload({
      id: updated.id,
      author: updated.senderHandle ?? "Instagram user",
      text: updated.text,
      imageUrl: updated.imageUrl,
      attachments: updated.attachments,
      sentAt: updated.sentAt,
      readByName: updated.readByName,
      readAt: updated.readAt,
    });
    await editChannelMessage(updated.channelId, updated.messageId, {
      embeds: payload.embeds,
      components: payload.components,
    }).catch((err) => console.error("[instagram] edit failed:", err));
  }

  revalidatePath("/instagram");
}

/** Drop a DM from the tab and from Discord. */
export async function deleteMessage(id: string) {
  await assertMaster();

  const row = await prisma.instagramMessage.findUnique({ where: { id } });
  if (!row) return;

  if (row.channelId && row.messageId) {
    await deleteChannelMessage(row.channelId, row.messageId).catch((err) =>
      console.error("[instagram] delete failed:", err),
    );
  }
  await prisma.instagramMessage.delete({ where: { id } }).catch(() => undefined);

  revalidatePath("/instagram");
}
