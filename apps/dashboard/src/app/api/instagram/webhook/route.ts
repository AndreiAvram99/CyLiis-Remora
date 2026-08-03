import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { buildInstagramMessagePayload } from "@repo/shared";
import { env } from "@/lib/env";
import { postChannelMessage } from "@/lib/discord";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GRAPH = "https://graph.instagram.com/v23.0";

interface Attachment {
  type?: string;
  payload?: { url?: string };
}

interface Messaging {
  sender?: { id?: string };
  timestamp?: number | string;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    is_unsupported?: boolean;
    attachments?: Attachment[];
    reply_to?: { story?: unknown; mid?: string };
  };
}

interface Entry {
  messaging?: Messaging[];
  changes?: { field?: string; value?: Messaging }[];
}

/** Real DMs arrive under `messaging`; Meta's test button uses `changes`. */
function eventsIn(entry: Entry): Messaging[] {
  if (entry.messaging?.length) return entry.messaging;
  return (entry.changes ?? [])
    .filter((c) => c.field === "messages" && c.value)
    .map((c) => c.value as Messaging);
}

/** Timestamps come as epoch millis, except the test sample, which uses seconds. */
function sentAt(raw: number | string | undefined): Date {
  const n = Number(raw);
  if (!n) return new Date();
  return new Date(n < 1e12 ? n * 1000 : n);
}

/**
 * Meta signs every delivery with the app secret. Reject anything we can't
 * verify — the endpoint is public, so this is the only thing separating a real
 * notification from someone posting into the channel at will. Returns the
 * reason it failed, or null when the delivery is genuine.
 */
function signatureProblem(raw: string, header: string | null): string | null {
  const secret = env.instagramAppSecret();
  if (!secret) return "INSTAGRAM_APP_SECRET is not set";
  if (!header?.startsWith("sha256=")) return "no x-hub-signature-256 header";

  const expected = createHmac("sha256", secret).update(raw, "utf8").digest();
  const received = Buffer.from(header.slice("sha256=".length), "hex");
  if (received.length !== expected.length) return "malformed signature";
  if (!timingSafeEqual(expected, received)) {
    return "signature mismatch — INSTAGRAM_APP_SECRET is probably wrong";
  }
  return null;
}

interface Profile {
  handle: string;
  avatar: string | null;
}

const UNKNOWN_SENDER: Profile = { handle: "Instagram user", avatar: null };
const profileCache = new Map<string, Profile>();

/**
 * The sender's handle and picture. Webhooks only carry an opaque id, so look it
 * up. Note the picture is a signed CDN url that expires after a while, which is
 * why anything showing it needs a fallback.
 */
async function profileFor(igsid: string): Promise<Profile> {
  const cached = profileCache.get(igsid);
  if (cached) return cached;

  const token = env.instagramAccessToken();
  if (!token) return UNKNOWN_SENDER;

  try {
    const res = await fetch(
      `${GRAPH}/${igsid}?fields=username,name,profile_pic&access_token=${token}`,
    );
    if (!res.ok) return UNKNOWN_SENDER;
    const data = (await res.json()) as {
      username?: string;
      name?: string;
      profile_pic?: string;
    };
    const profile: Profile = {
      handle: data.username
        ? `@${data.username}`
        : data.name || UNKNOWN_SENDER.handle,
      avatar: data.profile_pic ?? null,
    };
    profileCache.set(igsid, profile);
    return profile;
  } catch {
    return UNKNOWN_SENDER;
  }
}

/**
 * Why a message wasn't forwarded, or null when it should be. Only story traffic
 * and our own replies are dropped: for anything else, posting it imperfectly
 * beats losing it, so shared posts and reels come through as links.
 */
function dropReason(m: Messaging): string | null {
  const msg = m.message;
  if (!msg?.mid) return "no message id";
  if (msg.is_echo) return "echo of our own reply";
  if (msg.is_deleted) return "deleted by the sender";
  if (msg.reply_to?.story) return "story reply";
  if (msg.attachments?.some((a) => a.type === "story_mention")) {
    return "story mention";
  }
  // Unsupported types carry no content, but they still tell the team a DM
  // arrived, so they're forwarded with a placeholder rather than dropped.
  if (!msg.text?.trim() && !msg.attachments?.length && !msg.is_unsupported) {
    return "no text and no attachments";
  }
  return null;
}

/** Attachment types, for the logs, so odd payloads are recognisable. */
function describe(m: Messaging): string {
  const types = (m.message?.attachments ?? []).map((a) => a.type ?? "unknown");
  const parts = [m.message?.text?.trim() ? "text" : null, ...types].filter(
    Boolean,
  );
  if (m.message?.is_unsupported) parts.push("unsupported");
  return parts.length ? parts.join(" + ") : "empty";
}

const UNSUPPORTED_NOTE =
  "(Instagram sent a message type the API can't read — open the inbox to see it)";

interface Content {
  text: string | null;
  imageUrl: string | null;
  attachments: string[];
}

function contentOf(m: Messaging): Content {
  const msg = m.message!;
  const all = msg.attachments ?? [];
  return {
    text: msg.text?.trim() || (msg.is_unsupported ? UNSUPPORTED_NOTE : null),
    imageUrl: all.find((a) => a.type === "image")?.payload?.url ?? null,
    attachments: all
      .filter((a) => a.type !== "image")
      .map((a) => `${a.type ?? "file"}${a.payload?.url ? `: ${a.payload.url}` : ""}`),
  };
}

/**
 * Meta retries anything it doesn't get a 200 for, so record the message before
 * posting it. The unique `mid` makes a retry fail here rather than duplicate
 * the Discord post, and the row is what the dashboard tab reads later.
 */
async function claimMessage(m: Messaging): Promise<{ id: string } | null> {
  try {
    return await prisma.instagramMessage.create({
      data: {
        mid: m.message!.mid!,
        senderId: m.sender?.id ?? null,
        ...contentOf(m),
        sentAt: sentAt(m.timestamp),
      },
      select: { id: true },
    });
  } catch {
    return null; // already forwarded
  }
}

async function forward(id: string, m: Messaging) {
  const sender = await profileFor(m.sender?.id ?? "");
  const channelId = env.instagramChannelId();

  const payload = buildInstagramMessagePayload({
    id,
    author: sender.handle,
    authorIcon: sender.avatar,
    ...contentOf(m),
    sentAt: sentAt(m.timestamp),
  });

  const messageId = await postChannelMessage(channelId, payload);

  // Remember where it landed so the bot can edit it when someone reads it.
  await prisma.instagramMessage.update({
    where: { id },
    data: {
      senderHandle: sender.handle,
      senderAvatar: sender.avatar,
      channelId,
      messageId,
    },
  });
}

/** Meta's subscription handshake. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const verify = env.instagramVerifyToken();

  if (
    params.get("hub.mode") === "subscribe" &&
    verify &&
    params.get("hub.verify_token") === verify
  ) {
    return new NextResponse(params.get("hub.challenge") ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  console.log(`[instagram] delivery received (${raw.length} bytes)`);

  const problem = signatureProblem(raw, req.headers.get("x-hub-signature-256"));
  if (problem) {
    console.warn(`[instagram] rejected delivery: ${problem}`);
    return new NextResponse("Invalid signature", { status: 403 });
  }

  let body: { object?: string; entry?: Entry[] };
  try {
    body = JSON.parse(raw);
  } catch {
    console.warn("[instagram] rejected delivery: body is not JSON");
    return new NextResponse("Bad payload", { status: 400 });
  }

  if (body.object !== "instagram") {
    console.warn(`[instagram] ignored delivery for object=${body.object}`);
    return new NextResponse("EVENT_RECEIVED");
  }

  for (const entry of body.entry ?? []) {
    const events = eventsIn(entry);
    if (!events.length) {
      console.log(
        `[instagram] entry carried no message events, keys: ${Object.keys(entry).join(", ")}`,
      );
      continue;
    }

    for (const m of events) {
      const mid = m.message?.mid ?? "unknown";
      const skip = dropReason(m);
      if (skip) {
        console.log(`[instagram] ${mid}: skipped, ${skip} (${describe(m)})`);
        continue;
      }
      console.log(`[instagram] ${mid}: forwarding ${describe(m)}`);
      const row = await claimMessage(m);
      if (!row) {
        console.log(`[instagram] ${mid}: skipped, already forwarded`);
        continue;
      }
      try {
        await forward(row.id, m);
        console.log(`[instagram] ${mid}: posted to Discord`);
      } catch (err) {
        console.error(`[instagram] ${mid}: forward failed:`, err);
      }
    }
  }

  // Always acknowledge: a non-200 makes Meta retry the whole batch.
  return new NextResponse("EVENT_RECEIVED");
}
