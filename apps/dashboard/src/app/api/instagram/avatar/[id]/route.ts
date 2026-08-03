import { NextResponse } from "next/server";
import { loadAvatar } from "@/lib/instagram-avatar";

export const runtime = "nodejs";

/**
 * Serves a sender's profile picture from our cache. Public on purpose: Discord
 * fetches these urls when rendering an embed, and the pictures are already
 * public on Instagram.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const avatar = await loadAvatar(id).catch(() => null);
  if (!avatar) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": avatar.mime,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
