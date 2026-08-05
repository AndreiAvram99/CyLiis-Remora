import Link from "next/link";
import { Pencil, MapPin, Hash, Bell, AlertTriangle } from "lucide-react";
import { RsvpStatus } from "@repo/db";
import { durationLabel, recurrenceBadge } from "@repo/shared";
import { Badge, Button, Card } from "@/components/ui";
import { formatInTz, relativeTo } from "@/lib/time";
import { AgendaButton } from "./agenda-button";
import { DeleteEventButton } from "./delete-button";

const KIND_STYLES: Record<string, string> = {
  MEETING: "bg-palette-sky/10 text-palette-sky",
  EVENT: "bg-palette-sun/10 text-palette-sun",
  CUSTOM: "bg-palette-flame/10 text-palette-flame",
  PRINT: "bg-palette-azure/10 text-palette-azure",
};

export interface ScheduleCardEvent {
  id: string;
  title: string;
  kind: string;
  startAt: Date;
  recurrence: string;
  durationMinutes: number | null;
  location: string | null;
  agendaDocUrl: string | null;
  rsvps: { status: RsvpStatus }[];
  reminders: {
    status: string;
    isAnnouncement: boolean;
    error: string | null;
    attempts: number;
    nextAttemptAt: Date | null;
  }[];
}

export function ScheduleCard({
  event,
  timezone,
  channelName,
  isManager,
  canDelete,
}: {
  event: ScheduleCardEvent;
  timezone: string;
  channelName: string;
  isManager: boolean;
  canDelete: boolean;
}) {
  const going = event.rsvps.filter((r) => r.status === RsvpStatus.GOING).length;
  const motivated = event.rsvps.filter(
    (r) => r.status === RsvpStatus.MOTIVATED,
  ).length;
  const pending = event.reminders.filter(
    (r) => r.status === "PENDING" && !r.isAnnouncement,
  ).length;
  // A post Discord refused is otherwise invisible — the card just looks quiet.
  const failed = event.reminders.find((r) => r.status === "FAILED");

  return (
    <Card className="flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge className={KIND_STYLES[event.kind]}>{event.kind}</Badge>
          {isManager ? (
            <Link
              href={`/events/${event.id}`}
              className="truncate text-lg font-medium hover:underline"
            >
              {event.title}
            </Link>
          ) : (
            <span className="truncate text-lg font-medium">{event.title}</span>
          )}
        </div>
        <div className="mt-1 text-sm text-neutral-300">
          {formatInTz(event.startAt, timezone)}{" "}
          <span className="text-neutral-500">
            ({relativeTo(event.startAt)})
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <Hash size={12} />
            {channelName}
          </span>
          {event.location ? (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {event.location}
            </span>
          ) : null}
          <span className="flex items-center gap-1">
            <Bell size={12} />
            {pending} reminder{pending === 1 ? "" : "s"} scheduled
          </span>
          {event.kind === "MEETING" && event.durationMinutes ? (
            <span>{durationLabel(event.durationMinutes)}</span>
          ) : null}
          {recurrenceBadge(event.recurrence) ? (
            <span className="text-palette-azure">
              {recurrenceBadge(event.recurrence)}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-palette-azure" />
            {going} going
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-palette-sun" />
            {motivated} motivation
          </span>
        </div>
        {failed && isManager ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-red-400">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>
              Discord refused the{" "}
              {failed.isAnnouncement ? "announcement" : "reminder"}
              {failed.error ? `: ${failed.error}` : "."}{" "}
              {failed.nextAttemptAt
                ? `Trying again ${relativeTo(failed.nextAttemptAt)} — fix the cause and it posts itself, or save the schedule to force it now.`
                : failed.attempts > 1
                  ? `Gave up after ${failed.attempts} tries. Save the schedule to try again.`
                  : "Save the schedule to try again."}
            </span>
          </p>
        ) : null}
      </div>
      {isManager ? (
        <div className="flex items-center gap-2">
          {event.kind === "MEETING" ? (
            <AgendaButton id={event.id} docUrl={event.agendaDocUrl} />
          ) : null}
          <Link href={`/events/${event.id}`} title="Edit" aria-label="Edit">
            <Button variant="secondary" className="w-11 px-0 sm:w-auto sm:px-5">
              <Pencil size={16} />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </Link>
          {canDelete ? (
            <DeleteEventButton id={event.id} title={event.title} />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
