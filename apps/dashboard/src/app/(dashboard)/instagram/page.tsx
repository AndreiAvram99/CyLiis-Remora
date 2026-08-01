import { Instagram } from "lucide-react";
import { prisma } from "@repo/db";
import { Card } from "@/components/ui";
import { getGuild } from "@/lib/guild";
import { requireMember } from "@/lib/session";
import { formatInTz, relativeTo } from "@/lib/time";

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

export default async function InstagramPage() {
  await requireMember();
  const guild = await getGuild();

  const messages = await prisma.instagramMessage.findMany({
    orderBy: { sentAt: "desc" },
    take: 100,
  });
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

      {messages.length ? (
        <p className="text-sm text-neutral-400">
          {unread === 0
            ? "Everything has been picked up."
            : `${unread} waiting for someone to pick ${unread === 1 ? "it" : "them"} up.`}
        </p>
      ) : null}

      {messages.length === 0 ? (
        <Card className="text-sm text-neutral-400">
          No messages yet. Anything sent to the Instagram account lands here.
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <Card
              key={m.id}
              className={`p-5 ${m.readById ? "" : "border-[rgba(229,109,109,0.35)]"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-neutral-100">
                    {m.senderHandle ?? "Instagram user"}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {formatInTz(m.sentAt, guild.timezone)} ·{" "}
                    {relativeTo(m.sentAt)}
                  </p>
                </div>
                <ReadBadge
                  name={m.readByName}
                  at={m.readAt}
                  timezone={guild.timezone}
                />
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
