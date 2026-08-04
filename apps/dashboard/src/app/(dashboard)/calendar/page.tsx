import Link from "next/link";
import { headers } from "next/headers";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DateTime } from "luxon";
import { prisma, type EventKind } from "@repo/db";
import { Card } from "@/components/ui";
import { getGuild } from "@/lib/guild";
import { channelColorOf } from "@/lib/channel-color";
import { env } from "@/lib/env";
import { calendarFeedToken } from "@/lib/ics";
import { SubscribeButton } from "./subscribe-button";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Pill colors per kind, reusing the theme-aware palette utilities.
const PILL_STYLES: Record<string, string> = {
  MEETING: "bg-palette-sky/20 text-palette-sky",
  EVENT: "bg-palette-sun/20 text-palette-sun",
  CUSTOM: "bg-palette-flame/20 text-palette-flame",
};

interface CalItem {
  id: string;
  title: string;
  start: Date;
  allDay: boolean;
  styleKey: string;
  // Schedules are tinted with their channel's color; kind styling is the
  // fallback for channels with no color set.
  color?: string;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const guild = await getGuild();
  const zone = guild.timezone;
  const { m } = await searchParams;

  const parsed = m ? DateTime.fromFormat(m, "yyyy-LL", { zone }) : null;
  const month = (
    parsed?.isValid ? parsed : DateTime.now().setZone(zone)
  ).startOf("month");

  // Six-week grid starting on the Monday on/just before the 1st.
  const gridStart = month.startOf("week");
  const gridEnd = month.endOf("month").endOf("week");
  const todayKey = DateTime.now().setZone(zone).toFormat("yyyy-LL-dd");

  const appEvents = await prisma.event.findMany({
    where: {
      guildId: env.guildId(),
      // Print requests are internal to-dos, not calendar entries.
      kind: { not: "PRINT" },
      startAt: { gte: gridStart.toJSDate(), lte: gridEnd.toJSDate() },
    },
    select: {
      id: true,
      title: true,
      startAt: true,
      allDay: true,
      kind: true,
      channelId: true,
      seriesId: true,
    },
  });

  const channels = await prisma.channel.findMany({
    where: { guildId: env.guildId() },
    select: { id: true, name: true, color: true },
  });
  const channelColor = new Map(channels.map((c) => [c.id, channelColorOf(c)]));

  // The worker only materializes one occurrence at a time, so project the rest
  // of each active series locally, keeping repeats visible on the grid.
  const seriesRows = await prisma.event.findMany({
    where: {
      guildId: env.guildId(),
      kind: { not: "PRINT" },
      recurrence: { not: "NONE" },
      recurrenceActive: true,
      startAt: { lte: gridEnd.toJSDate() },
    },
    select: {
      id: true,
      title: true,
      startAt: true,
      allDay: true,
      kind: true,
      channelId: true,
      recurrence: true,
      seriesId: true,
    },
  });

  const dayKeyOf = (d: Date) =>
    DateTime.fromJSDate(d).setZone(zone).toFormat("yyyy-LL-dd");
  const materialized = new Set(
    appEvents.map((e) => `${e.seriesId ?? e.id}:${dayKeyOf(e.startAt)}`),
  );

  const stepOf = (rec: string) =>
    rec === "WEEKLY"
      ? { weeks: 1 }
      : rec === "MONTHLY"
        ? { months: 1 }
        : rec === "YEARLY"
          ? { years: 1 }
          : null;

  // One anchor per series: its earliest occurrence defines the repeat pattern.
  const anchors = new Map<string, (typeof seriesRows)[number]>();
  for (const row of seriesRows) {
    const key = row.seriesId ?? row.id;
    const current = anchors.get(key);
    if (!current || row.startAt < current.startAt) anchors.set(key, row);
  }

  const projected: CalItem[] = [];
  for (const [key, anchor] of anchors) {
    const step = stepOf(anchor.recurrence);
    if (!step) continue;
    let dt = DateTime.fromJSDate(anchor.startAt).setZone(zone);
    // Bounded walk: a month grid can never need more than a handful of steps.
    for (let i = 0; i < 400 && dt <= gridEnd; i++) {
      const key2 = `${key}:${dt.toFormat("yyyy-LL-dd")}`;
      if (dt >= gridStart && !materialized.has(key2)) {
        projected.push({
          id: `${key}-${dt.toMillis()}`,
          title: anchor.title,
          start: dt.toJSDate(),
          allDay: anchor.allDay,
          styleKey: anchor.kind as EventKind,
          color: channelColor.get(anchor.channelId),
        });
      }
      dt = dt.plus(step);
    }
  }

  const items: CalItem[] = [
    ...appEvents.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.startAt,
      allDay: e.allDay,
      styleKey: e.kind as EventKind,
      color: channelColor.get(e.channelId),
    })),
    ...projected,
  ];

  // Bucket items by their local (guild tz) day.
  const byDay = new Map<string, CalItem[]>();
  for (const it of items) {
    const key = DateTime.fromJSDate(it.start)
      .setZone(zone)
      .toFormat("yyyy-LL-dd");
    const list = byDay.get(key) ?? [];
    list.push(it);
    byDay.set(key, list);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  // Build day cells.
  const days: DateTime[] = [];
  for (let d = gridStart; d <= gridEnd; d = d.plus({ days: 1 })) days.push(d);

  const prevM = month.minus({ months: 1 }).toFormat("yyyy-LL");
  const nextM = month.plus({ months: 1 }).toFormat("yyyy-LL");

  // Absolute feed URL for the subscribe menu (works for external calendar apps).
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const base = process.env.NEXTAUTH_URL || (host ? `${proto}://${host}` : "");
  const feedUrl = `${base}/api/calendar.ics?token=${calendarFeedToken()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight sm:text-[38px] sm:leading-tight">
            {month.toFormat("LLLL yyyy")}
          </h1>
          <p className="text-sm text-neutral-500">
            Meetings and events from Remora. Times in {zone}.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <SubscribeButton feedUrl={feedUrl} />
          <Link
            href={`/calendar?m=${prevM}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-200 transition hover:bg-neutral-700"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </Link>
          <Link
            href="/calendar"
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 transition hover:bg-neutral-700"
          >
            Today
          </Link>
          <Link
            href={`/calendar?m=${nextM}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-200 transition hover:bg-neutral-700"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b border-[rgb(var(--line))] bg-neutral-950">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
            >
              <span className="hidden sm:inline">{w}</span>
              <span className="sm:hidden">{w[0]}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = day.toFormat("yyyy-LL-dd");
            const inMonth = day.month === month.month;
            const isToday = key === todayKey;
            const dayItems = byDay.get(key) ?? [];
            const shown = dayItems.slice(0, 3);
            const extra = dayItems.length - shown.length;
            return (
              <div
                key={key}
                className={`min-h-[84px] border-b border-r border-[rgb(var(--line))] p-1.5 sm:min-h-[110px] ${
                  inMonth ? "" : "bg-neutral-950 text-neutral-600"
                }`}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday
                        ? "bg-brand font-semibold text-brand-fg"
                        : inMonth
                          ? "text-neutral-300"
                          : "text-neutral-600"
                    }`}
                  >
                    {day.day}
                  </span>
                </div>
                <div className="space-y-1">
                  {shown.map((it) => (
                    <div
                      key={it.id}
                      title={it.title}
                      className={`break-words rounded px-1.5 py-0.5 text-[11px] leading-tight ${it.color ? "" : PILL_STYLES[it.styleKey]}`}
                      style={
                        it.color
                          ? {
                              color: it.color,
                              backgroundColor: `${it.color}22`,
                            }
                          : undefined
                      }
                    >
                      {!it.allDay ? (
                        <span className="tabular-nums opacity-80">
                          {DateTime.fromJSDate(it.start)
                            .setZone(zone)
                            .toFormat("HH:mm")}{" "}
                        </span>
                      ) : null}
                      {it.title}
                    </div>
                  ))}
                  {extra > 0 ? (
                    <div className="px-1.5 text-[10px] text-neutral-500">
                      +{extra} more
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="text-xs text-neutral-500">
        Schedules use their channel color.
      </div>
    </div>
  );
}
