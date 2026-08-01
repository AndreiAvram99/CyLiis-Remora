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

const profileCache = new Map<string, string>();

/** The sender's handle. Webhooks only carry an opaque id, so look it up. */
async function handleFor(igsid: string): Promise<string> {
  const cached = profileCache.get(igsid);
  if (cached) return cached;

  const token = env.instagramAccessToken();
  if (!token) return "Instagram user";

  try {
    const res = await fetch(
      `${GRAPH}/${igsid}?fields=username,name&access_token=${token}`,
    );
    if (!res.ok) return "Instagram user";
    const data = (await res.json()) as { username?: string; name?: string };
    const name = data.username
      ? `@${data.username}`
      : data.name || "Instagram user";
    profileCache.set(igsid, name);
    return name;
  } catch {
    return "Instagram user";
  }
}

/**
 * Only plain direct messages are forwarded. Story replies, story mentions,
 * echoes of our own replies and deletions are all dropped.
 */
function shouldForward(m: Messaging): boolean {
  const msg = m.message;
  if (!msg?.mid) return false;
  if (msg.is_echo || msg.is_deleted || msg.is_unsupported) return false;
  if (msg.reply_to?.story) return false;
  if (msg.attachments?.some((a) => a.type === "story_mention")) return false;
  return Boolean(msg.text?.trim() || msg.attachments?.length);
}

/**
 * Meta retries anything it doesn't get a 200 for, so record the message before
 * posting it. The unique `mid` makes a retry fail here rather than duplicate
 * the Discord post, and the row is what the dashboard tab reads later.
 */
async function claimMessage(m: Messaging): Promise<{ id: string } | null> {
  const msg = m.message!;
  try {
    return await prisma.instagramMessage.create({
      data: {
        mid: msg.mid!,
        senderId: m.sender?.id ?? null,
        text: msg.text?.trim() || null,
        imageUrl:
          msg.attachments?.find((a) => a.type === "image")?.payload?.url ?? null,
        attachments: (msg.attachments ?? [])
          .filter((a) => a.type !== "image")
          .map((a) => `${a.type ?? "file"}${a.payload?.url ? `: ${a.payload.url}` : ""}`),
        sentAt: sentAt(m.timestamp),
      },
      select: { id: true },
    });
  } catch {
    return null; // already forwarded
  }
}

async function forward(id: string, m: Messaging) {
  const msg = m.message!;
  const author = await handleFor(m.sender?.id ?? "");
  const channelId = env.instagramChannelId();

  const payload = buildInstagramMessagePayload({
    id,
    author,
    text: msg.text,
    imageUrl:
      msg.attachments?.find((a) => a.type === "image")?.payload?.url ?? null,
    attachments: (msg.attachments ?? [])
      .filter((a) => a.type !== "image")
      .map((a) => `${a.type ?? "file"}${a.payload?.url ? `: ${a.payload.url}` : ""}`),
    sentAt: sentAt(m.timestamp),
  });

  const messageId = await postChannelMessage(channelId, payload);

  // Remember where it landed so the bot can edit it when someone reads it.
  await prisma.instagramMessage.update({
    where: { id },
    data: { senderHandle: author, channelId, messageId },
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
      if (!shouldForward(m)) {
        console.log(`[instagram] ${mid}: skipped, not a plain DM`);
        continue;
      }
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
