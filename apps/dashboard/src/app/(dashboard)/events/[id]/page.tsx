import { notFound } from "next/navigation";
import { prisma, ReminderStatus } from "@repo/db";
import type { EventKindName } from "@repo/shared";
import { getGuild, getTextChannels } from "@/lib/guild";
import { getKindDefaults } from "@/lib/defaults";
import { requireManager } from "@/lib/session";
import { dateToLocalInput, dateToLocalDateInput } from "@/lib/time";
import { EventForm, type EventFormInitial } from "../event-form";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;
  const [guild, channels, kindDefaults, event] = await Promise.all([
    getGuild(),
    getTextChannels(),
    getKindDefaults(),
    prisma.event.findUnique({
      where: { id },
      include: { reminders: true },
    }),
  ]);

  if (!event) notFound();

  const initial: EventFormInitial = {
    title: event.title,
    description: event.description ?? "",
    kind: event.kind as EventKindName,
    startAt: event.allDay
      ? dateToLocalDateInput(event.startAt, guild.timezone)
      : dateToLocalInput(event.startAt, guild.timezone),
    endAt: event.endAt
      ? event.allDay
        ? dateToLocalDateInput(event.endAt, guild.timezone)
        : dateToLocalInput(event.endAt, guild.timezone)
      : "",
    durationMinutes: event.durationMinutes,
    recurrence: event.recurrence,
    location: event.location ?? "",
    url: event.url ?? "",
    channelId: event.channelId,
    announceOnCreate: event.announceOnCreate,
    reminders: event.reminders
      .filter(
        (r) =>
          !r.isAnnouncement &&
          (r.status === ReminderStatus.PENDING ||
            r.status === ReminderStatus.CANCELLED),
      )
      .sort((a, b) => b.offsetMinutes - a.offsetMinutes)
      .map((r) => ({ offsetMinutes: r.offsetMinutes, channelId: r.channelId })),
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold tracking-tight sm:text-[38px] sm:leading-tight">
        Edit schedule
      </h1>
      <EventForm
        mode="edit"
        eventId={event.id}
        channels={channels.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
        }))}
        kindDefaults={kindDefaults}
        defaultChannelId={guild.defaultChannelId}
        initial={initial}
      />
    </div>
  );
}
