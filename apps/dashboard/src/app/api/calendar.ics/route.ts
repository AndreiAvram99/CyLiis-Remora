import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { env } from "@/lib/env";
import { buildIcs, calendarFeedToken, type IcsEvent } from "@/lib/ics";

export const dynamic = "force-dynamic";

/**
 * Public iCalendar feed of all app schedules (meetings + events, not print
 * jobs). Gated by an unguessable token so calendar apps — which can't send a
 * login cookie — can subscribe on iOS, Android, Google or Outlook.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token || token !== calendarFeedToken()) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Window: a year back through a year ahead keeps the feed light.
  const now = Date.now();
  const from = new Date(now - 365 * 24 * 60 * 60 * 1000);
  const to = new Date(now + 365 * 24 * 60 * 60 * 1000);

  const events = await prisma.event.findMany({
    where: {
      guildId: env.guildId(),
      kind: { not: "PRINT" },
      startAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      url: true,
      startAt: true,
      endAt: true,
      allDay: true,
      durationMinutes: true,
      updatedAt: true,
    },
    orderBy: { startAt: "asc" },
  });

  const domain = url.hostname || "cyremora.onrender.com";
  const ics = buildIcs(events as IcsEvent[], {
    name: "CyLiis Remora",
    domain,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="cyliis-remora.ics"',
      "Cache-Control": "public, max-age=1800",
    },
  });
}
