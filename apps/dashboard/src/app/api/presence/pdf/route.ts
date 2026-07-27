import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { getSession } from "@/lib/session";
import { getGuild } from "@/lib/guild";
import { env } from "@/lib/env";
import { buildPresencePdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "event"
  );
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.isMember) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = req.nextUrl.searchParams.get("eventId");
  const guild = await getGuild();

  const channels = await prisma.channel.findMany({
    where: { guildId: env.guildId() },
    select: { id: true, name: true },
  });
  const channelName = new Map(channels.map((c) => [c.id, c.name]));

  const events = await prisma.event.findMany({
    where: { guildId: env.guildId(), ...(eventId ? { id: eventId } : {}) },
    orderBy: { startAt: "desc" },
    include: {
      rsvps: {
        select: {
          userId: true,
          username: true,
          displayName: true,
          status: true,
          overriddenBy: true,
        },
        orderBy: { displayName: "asc" },
      },
    },
  });

  const pdf = await buildPresencePdf({
    guildName: guild.name,
    timezone: guild.timezone,
    events: events.map((e) => ({
      title: e.title,
      kind: e.kind,
      startAt: e.startAt,
      channelName: channelName.get(e.channelId) ?? "unknown",
      location: e.location,
      rsvps: e.rsvps,
    })),
  });

  const filename =
    eventId && events[0]
      ? `presence-${slug(events[0].title)}.pdf`
      : "presence-report.pdf";

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
