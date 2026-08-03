import { Instagram } from "lucide-react";
import { prisma } from "@repo/db";
import { Card } from "@/components/ui";
import { getGuild } from "@/lib/guild";
import { isMasterId, requireMember } from "@/lib/session";
import { formatInTz, relativeTo } from "@/lib/time";
import { MessageActions } from "./message-actions";
import { SenderAvatar } from "./sender-avatar";

export const dynamic = "force-dynamic";

function ReadBadge({
  name,
  at,
  timezone,
}: {
  name: string | null;
  at: Date | null;
  timezone: string;
}) {
  if (!name) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[rgba(229,109,109,0.12)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#E56D6D]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#E56D6D]" aria-hidden />
        Unread
      </span>
    );
  }
  return (
    <span
      title={at ? formatInTz(at, timezone) : undefined}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-neutral-800 px-2.5 py-1 text-[11px] font-medium text-neutral-300"
    >
      👀 Read by <span className="font-semibold text-neutral-100">{name}</span>
    </span>
  );
}

// Senders whose handle we never resolved share one option in the filter.
const UNKNOWN = "unknown";

export default async function InstagramPage({
  searchParams,
}: {
  searchParams: Promise<{ sender?: string }>;
}) {
  const session = await requireMember();
  const isMaster = isMasterId(session.user?.discordId);
  const guild = await getGuild();

  const { sender } = await searchParams;
  const where = sender
    ? { senderHandle: sender === UNKNOWN ? null : sender }
    : {};

  const [messages, senders] = await Promise.all([
    prisma.instagramMessage.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: 100,
    }),
    prisma.instagramMessage.findMany({
      distinct: ["senderHandle"],
      select: { senderHandle: true },
      orderBy: { senderHandle: "asc" },
    }),
  ]);
  const unread = messages.filter((m) => !m.readById).length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight sm:text-[38px] sm:leading-tight">
          <Instagram size={28} className="text-brand" />
          Instagram
        </h1>
        <p className="max-w-2xl text-sm text-neutral-500">
          Direct messages sent to the team account, forwarded to Discord. Tap
          “Mark as read” on the Discord message and whoever did it shows up
          here.
        </p>
      </div>

      {senders.length > 1 ? (
        <Card className="p-5">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              Sender
              <select
                name="sender"
                defaultValue={sender ?? ""}
                className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-3 py-2 text-sm text-neutral-200 outline-none focus:border-brand"
              >
                <option value="">Everyone</option>
                {senders.map((s) => (
                  <option
                    key={s.senderHandle ?? UNKNOWN}
                    value={s.senderHandle ?? UNKNOWN}
                  >
                    {s.senderHandle ?? "Instagram user"}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-700"
            >
              Apply
            </button>
            {sender ? (
              <a
                href="/instagram"
                className="rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:text-neutral-100"
              >
                Clear
              </a>
            ) : null}
          </form>
        </Card>
      ) : null}

      {messages.length ? (
        <p className="text-sm text-neutral-400">
          {unread === 0
            ? "Everything has been picked up."
            : `${unread} waiting for someone to pick ${unread === 1 ? "it" : "them"} up.`}
        </p>
      ) : null}

      {messages.length === 0 ? (
        <Card className="text-sm text-neutral-400">
          {sender
            ? "No messages from this sender."
            : "No messages yet. Anything sent to the Instagram account lands here."}
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <Card
              key={m.id}
              className={`p-5 ${m.readById ? "" : "border-[rgba(229,109,109,0.35)]"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <SenderAvatar
                    // Prefer our cached copy, which also backfills the pictures
                    // of messages stored before caching existed.
                    src={
                      m.senderId
                        ? `/api/instagram/avatar/${m.senderId}`
                        : m.senderAvatar
                    }
                    handle={m.senderHandle ?? "Instagram user"}
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-neutral-100">
                      {m.senderHandle ?? "Instagram user"}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatInTz(m.sentAt, guild.timezone)} ·{" "}
                      {relativeTo(m.sentAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ReadBadge
                    name={m.readByName}
                    at={m.readAt}
                    timezone={guild.timezone}
                  />
                  {isMaster ? (
                    <MessageActions id={m.id} read={Boolean(m.readById)} />
                  ) : null}
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-neutral-300">
                {m.text || <span className="text-neutral-500">(no text)</span>}
              </p>

              {m.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.imageUrl}
                  alt=""
                  className="mt-3 max-h-64 rounded-xl border border-[rgb(var(--line))] object-contain"
                />
              ) : null}

              {m.attachments.length ? (
                <p className="mt-3 text-xs text-neutral-500">
                  {m.attachments.length} attachment
                  {m.attachments.length === 1 ? "" : "s"}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
