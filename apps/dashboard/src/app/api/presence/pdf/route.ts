import { NextResponse, type NextRequest } from "next/server";
import { DateTime } from "luxon";
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
  const from = req.nextUrl.searchParams.get("from") ?? undefined;
  const to = req.nextUrl.searchParams.get("to") ?? undefined;
  const guild = await getGuild();

  const boundary = (value: string | undefined, edge: "start" | "end") => {
    if (!value) return null;
    const dt = DateTime.fromISO(value, { zone: guild.timezone });
    if (!dt.isValid) return null;
    return (edge === "start" ? dt.startOf("day") : dt.endOf("day")).toJSDate();
  };
  const fromDate = boundary(from, "start");
  const toDate = boundary(to, "end");
  const startAtFilter: { gte?: Date; lte?: Date } = {};
  if (fromDate) startAtFilter.gte = fromDate;
  if (toDate) startAtFilter.lte = toDate;

  const channels = await prisma.channel.findMany({
    where: { guildId: env.guildId() },
    select: { id: true, name: true },
  });
  const channelName = new Map(channels.map((c) => [c.id, c.name]));

  const events = await prisma.event.findMany({
    where: {
      guildId: env.guildId(),
      ...(eventId ? { id: eventId } : {}),
      ...(!eventId && (fromDate || toDate) ? { startAt: startAtFilter } : {}),
    },
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
    events: events
      .filter((e) => e.kind !== "PRINT")
      .map((e) => ({
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
