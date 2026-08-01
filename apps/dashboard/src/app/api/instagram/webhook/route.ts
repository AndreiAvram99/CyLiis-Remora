import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { env } from "@/lib/env";
import { postChannelMessage } from "@/lib/discord";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INSTAGRAM_PINK = 0xe1306c;
const GRAPH = "https://graph.instagram.com/v23.0";

interface Attachment {
  type?: string;
  payload?: { url?: string };
}

interface Messaging {
  sender?: { id?: string };
  timestamp?: number;
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

/**
 * Meta signs every delivery with the app secret. Reject anything we can't
 * verify — the endpoint is public, so this is the only thing separating a real
 * notification from someone posting into the channel at will.
 */
function verifySignature(raw: string, header: string | null): boolean {
  const secret = env.instagramAppSecret();
  if (!secret || !header?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(raw, "utf8").digest();
  const received = Buffer.from(header.slice("sha256=".length), "hex");
  if (received.length !== expected.length) return false;
  return timingSafeEqual(expected, received);
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
 * Meta retries anything it doesn't get a 200 for, so remember which messages
 * were posted. Keys live in the settings table and are pruned after a week.
 */
async function claimMessage(mid: string): Promise<boolean> {
  try {
    await prisma.setting.create({
      data: { key: `ig-mid:${mid}`, value: new Date().toISOString() },
    });
    return true;
  } catch {
    return false; // already forwarded
  }
}

async function pruneOldKeys() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.setting
    .deleteMany({
      where: { key: { startsWith: "ig-mid:" }, updatedAt: { lt: cutoff } },
    })
    .catch(() => undefined);
}

async function forward(m: Messaging) {
  const msg = m.message!;
  const author = await handleFor(m.sender?.id ?? "");
  const image = msg.attachments?.find((a) => a.type === "image")?.payload?.url;
  const others = (msg.attachments ?? []).filter((a) => a.type !== "image");

  const fields = others.length
    ? [
        {
          name: "Attachments",
          value: others
            .map((a) => `${a.type ?? "file"}${a.payload?.url ? `: ${a.payload.url}` : ""}`)
            .join("\n")
            .slice(0, 1000),
        },
      ]
    : undefined;

  await postChannelMessage(env.instagramChannelId(), {
    embeds: [
      {
        title: "📩 Instagram DM",
        author: { name: author },
        description: msg.text?.trim()?.slice(0, 4000) || "(no text)",
        color: INSTAGRAM_PINK,
        image: image ? { url: image } : undefined,
        fields,
        timestamp: new Date(m.timestamp ?? Date.now()).toISOString(),
      },
    ],
    // A DM containing "@everyone" must never ping the server.
    allowed_mentions: { parse: [] },
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
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  let body: { object?: string; entry?: { messaging?: Messaging[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }

  if (body.object !== "instagram") return new NextResponse("EVENT_RECEIVED");

  for (const entry of body.entry ?? []) {
    for (const m of entry.messaging ?? []) {
      if (!shouldForward(m)) continue;
      if (!(await claimMessage(m.message!.mid!))) continue;
      try {
        await forward(m);
      } catch (err) {
        console.error("[instagram] forward failed:", err);
      }
    }
  }

  void pruneOldKeys();
  // Always acknowledge: a non-200 makes Meta retry the whole batch.
  return new NextResponse("EVENT_RECEIVED");
}
