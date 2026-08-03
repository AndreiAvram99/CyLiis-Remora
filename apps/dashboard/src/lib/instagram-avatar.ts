import { prisma } from "@repo/db";
import { env } from "./env";

const GRAPH = "https://graph.instagram.com/v23.0";
const MAX_BYTES = 2 * 1024 * 1024;
/** Profile pictures change rarely; re-download a cached one after a month. */
const STALE_MS = 30 * 24 * 60 * 60 * 1000;

/** A stable url for a sender's picture, served by our own route. */
export function avatarProxyUrl(senderId: string): string | null {
  const base = env.publicUrl();
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/api/instagram/avatar/${senderId}`;
}

async function download(url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_BYTES) return null;

  return {
    mime: res.headers.get("content-type") ?? "image/jpeg",
    data: buffer,
  };
}

/** Store a picture we already have a (short-lived) url for. */
export async function cacheAvatar(senderId: string, url: string) {
  const image = await download(url);
  if (!image) return;
  await prisma.instagramAvatar.upsert({
    where: { id: senderId },
    create: { id: senderId, ...image },
    update: image,
  });
}

/** Ask Instagram for a fresh url, then cache what it points at. */
async function refresh(senderId: string) {
  const token = env.instagramAccessToken();
  if (!token) return null;

  const res = await fetch(
    `${GRAPH}/${senderId}?fields=profile_pic&access_token=${token}`,
  );
  if (!res.ok) return null;

  const { profile_pic: url } = (await res.json()) as { profile_pic?: string };
  if (!url) return null;

  const image = await download(url);
  if (!image) return null;

  return prisma.instagramAvatar.upsert({
    where: { id: senderId },
    create: { id: senderId, ...image },
    update: image,
  });
}

/**
 * The cached picture, refreshed from Instagram when missing or stale. A failed
 * refresh falls back to whatever we already had, since a slightly old picture
 * beats none at all.
 */
export async function loadAvatar(senderId: string) {
  const cached = await prisma.instagramAvatar.findUnique({
    where: { id: senderId },
  });
  if (cached && Date.now() - cached.updatedAt.getTime() < STALE_MS) {
    return cached;
  }
  return (await refresh(senderId).catch(() => null)) ?? cached;
}
