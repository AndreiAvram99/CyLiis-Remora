"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Video,
  CalendarDays,
  Printer,
  type LucideIcon,
} from "lucide-react";
import {
  fromOffsetMinutes,
  toOffsetMinutes,
  MEETING_DURATIONS,
  RECURRENCES,
  RECURRENCE_LABELS,
  type EventKindName,
  type ReminderUnit,
} from "@repo/shared";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { ChannelSelect } from "@/components/channel-select";
import { createEvent, updateEvent } from "./actions";
import { PrintForm } from "./print-form";
import { AttendeePicker, type AttendeeGroup } from "./attendee-picker";

type FormKind = EventKindName | "PRINT";

interface ChannelOption {
  id: string;
  name: string;
  color?: string | null;
}

interface ReminderRow {
  // Empty string while the user is typing/clearing; validated on save.
  value: number | "";
  unit: ReminderUnit;
  channelId: string;
}

export interface EventFormInitial {
  title: string;
  description: string;
  kind: EventKindName;
  startAt: string;
  endAt: string;
  durationMinutes: number | null;
  recurrence: string;
  location: string;
  url: string;
  channelId: string;
  announceOnCreate: boolean;
  reminders: Array<{ offsetMinutes: number; channelId: string | null }>;
  attendeeIds: string[];
}

const DEFAULT_DURATION = 60;
const isPresetDuration = (m: number) =>
  MEETING_DURATIONS.some((d) => d.minutes === m);

interface EventFormProps {
  mode: "create" | "edit";
  eventId?: string;
  channels: ChannelOption[];
  kindDefaults: Record<EventKindName, number[]>;
  defaultChannelId?: string | null;
  attendeeGroups: AttendeeGroup[];
  initial?: EventFormInitial;
}

// Selectable schedule types (Custom is retired). Printing is create-only.
const TYPE_OPTIONS: {
  key: FormKind;
  label: string;
  icon: LucideIcon;
  hint: string;
}[] = [
  { key: "MEETING", label: "Meeting", icon: Video, hint: "Time + duration" },
  { key: "EVENT", label: "Event", icon: CalendarDays, hint: "All-day dates" },
  { key: "PRINT", label: "Printing", icon: Printer, hint: "File to print" },
];

function offsetsToRows(offsets: number[]): ReminderRow[] {
  return offsets.map((o) => {
    const { value, unit } = fromOffsetMinutes(o);
    return { value, unit, channelId: "" };
  });
}

export function EventForm({
  mode,
  eventId,
  channels,
  kindDefaults,
  defaultChannelId,
  attendeeGroups,
  initial,
}: EventFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [kind, setKind] = useState<FormKind>(initial?.kind ?? "MEETING");
  const [startAt, setStartAt] = useState(initial?.startAt ?? "");
  const [endAt, setEndAt] = useState(initial?.endAt ?? "");
  const [durationMinutes, setDurationMinutes] = useState<number>(
    initial?.durationMinutes ?? DEFAULT_DURATION,
  );
  const [durationCustom, setDurationCustom] = useState<boolean>(
    initial?.durationMinutes != null && !isPresetDuration(initial.durationMinutes),
  );
  const [recurrence, setRecurrence] = useState<string>(
    initial?.recurrence ?? "NONE",
  );
  const [location, setLocation] = useState(initial?.location ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [channelId, setChannelId] = useState(
    initial?.channelId ?? defaultChannelId ?? channels[0]?.id ?? "",
  );
  const [announceOnCreate, setAnnounceOnCreate] = useState(
    initial?.announceOnCreate ?? true,
  );
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    initial?.attendeeIds ?? [],
  );
  const [reminders, setReminders] = useState<ReminderRow[]>(
    initial
      ? initial.reminders.map((r) => {
          const { value, unit } = fromOffsetMinutes(r.offsetMinutes);
          return { value, unit, channelId: r.channelId ?? "" };
        })
      : offsetsToRows(kindDefaults.MEETING ?? []),
  );

  function handleKindChange(next: FormKind) {
    // Meetings use a datetime + duration; events use date-only ranges — the
    // input formats differ, so clear the dates when switching between them.
    if ((next === "EVENT") !== (kind === "EVENT")) {
      setStartAt("");
      setEndAt("");
    }
    setKind(next);
    // In create mode, load that kind's default reminders as a starting point.
    // PRINT has none (it uses its own simple form).
    if (mode === "create" && next !== "PRINT") {
      setReminders(offsetsToRows(kindDefaults[next] ?? []));
    }
  }

  const isAllDay = kind === "EVENT";

  const printingChannelId = useMemo(
    () =>
      channels.find((c) => c.name.toLowerCase() === "printing")?.id ??
      channels[0]?.id,
    [channels],
  );

  function updateReminder(idx: number, patch: Partial<ReminderRow>) {
    setReminders((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  }

  function addReminder() {
    const preset: ReminderRow =
      kind === "EVENT"
        ? { value: 1, unit: "days", channelId: "" }
        : { value: 15, unit: "minutes", channelId: "" };
    setReminders((rows) => [...rows, preset]);
  }

  function removeReminder(idx: number) {
    setReminders((rows) => rows.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Every reminder needs a positive number — reject blank/0 fields instead of
    // silently coercing them to 0.
    const invalid = reminders.some(
      (r) => r.value === "" || Number(r.value) < 1,
    );
    if (invalid) {
      setError(
        "Enter a number (1 or more) for every reminder, or remove the empty row.",
      );
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      // PRINT is handled by its own form, so kind here is always a regular kind.
      kind: kind as EventKindName,
      startAt,
      endAt: isAllDay ? endAt || null : null,
      allDay: isAllDay,
      durationMinutes: isAllDay ? null : durationMinutes,
      recurrence: recurrence as "NONE" | "WEEKLY" | "MONTHLY" | "YEARLY",
      location: location.trim() || null,
      url: url.trim() || null,
      channelId,
      announceOnCreate,
      reminders: reminders.map((r) => ({
        offsetMinutes: toOffsetMinutes(Number(r.value), r.unit),
        channelId: r.channelId || null,
      })),
      // Only meetings track expected attendance.
      attendeeIds: kind === "MEETING" ? attendeeIds : [],
    };

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createEvent(payload);
        } else if (eventId) {
          await updateEvent(eventId, payload);
        }
        router.push("/events");
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong. Try again.",
        );
      }
    });
  }

  const noChannels = channels.length === 0;

  return (
    <div className="space-y-6">
      {noChannels ? (
        <Card className="border-palette-sun/40 bg-palette-sun/10 text-sm text-palette-sun">
          No channels found yet. Start the bot worker and make sure it can see
          your server so channels appear here.
        </Card>
      ) : null}

      <Card className="space-y-3">
        <Label>Type</Label>
        <div
          className={`grid gap-2 sm:gap-3 ${
            mode === "create" ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          {TYPE_OPTIONS.filter(
            (o) => mode === "create" || o.key !== "PRINT",
          ).map((o) => {
            const active = kind === o.key;
            const Icon = o.icon;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => handleKindChange(o.key)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-4 text-center transition ${
                  active
                    ? "border-brand bg-brand/10 text-neutral-100 ring-1 ring-brand"
                    : "border-[rgb(var(--line))] bg-[rgb(var(--input))] text-neutral-300 hover:border-neutral-600"
                }`}
              >
                <Icon
                  size={24}
                  className={active ? "text-brand" : "text-neutral-400"}
                />
                <span className="text-sm font-medium">{o.label}</span>
                <span className="text-[11px] leading-tight text-neutral-500">
                  {o.hint}
                </span>
              </button>
            );
          })}
        </div>
        {kind === "PRINT" ? (
          <p className="text-xs text-neutral-500">
            Printing just posts a file to a channel for someone to print — no
            dates, reminders or RSVP.
          </p>
        ) : null}
      </Card>

      {kind === "PRINT" ? (
        <PrintForm channels={channels} defaultChannelId={printingChannelId} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekly sync / Robotics Festival"
                required
              />
            </div>

            <div>
              <Label htmlFor="channel">Announcement channel</Label>
              <ChannelSelect
                id="channel"
                channels={channels}
                value={channelId}
                onChange={setChannelId}
                disabled={noChannels}
              />
            </div>

            {isAllDay ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="startAt">Start date</Label>
                  <Input
                    id="startAt"
                    type="date"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endAt">End date (optional)</Label>
                  <Input
                    id="endAt"
                    type="date"
                    value={endAt}
                    min={startAt || undefined}
                    onChange={(e) => setEndAt(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="startAt">Starts</Label>
                  <Input
                    id="startAt"
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duration</Label>
                  <Select
                    id="duration"
                    value={durationCustom ? "custom" : String(durationMinutes)}
                    onChange={(e) => {
                      if (e.target.value === "custom") {
                        setDurationCustom(true);
                      } else {
                        setDurationCustom(false);
                        setDurationMinutes(Number(e.target.value));
                      }
                    }}
                  >
                    {MEETING_DURATIONS.map((d) => (
                      <option key={d.minutes} value={d.minutes}>
                        {d.label}
                      </option>
                    ))}
                    <option value="custom">Custom…</option>
                  </Select>
                  {durationCustom ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={durationMinutes}
                        onChange={(e) =>
                          setDurationMinutes(Math.max(1, Number(e.target.value) || 0))
                        }
                        className="w-28"
                      />
                      <span className="text-sm text-neutral-500">minutes</span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="recurrence">Repeat</Label>
              <Select
                id="recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
              >
                {RECURRENCES.map((r) => (
                  <option key={r} value={r}>
                    {RECURRENCE_LABELS[r]}
                  </option>
                ))}
              </Select>
              {recurrence !== "NONE" ? (
                <p className="mt-1 text-xs text-neutral-500">
                  Repeats until you delete it. Each occurrence gets its own
                  announcement, reminders and RSVP — past attendance is kept.
                </p>
              ) : null}
            </div>

            {kind === "MEETING" ? (
              <AttendeePicker
                groups={attendeeGroups}
                selected={attendeeIds}
                onChange={setAttendeeIds}
              />
            ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Room 12 / Discord voice"
            />
          </div>
          <div>
            <Label htmlFor="url">Link (optional)</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this about?"
          />
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Reminders</h2>
            <p className="text-xs text-neutral-500">
              Meetings usually need minutes/hours; events days. Add as many as you
              want.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={addReminder}>
            <Plus size={16} /> Add
          </Button>
        </div>

        {reminders.length === 0 ? (
          <p className="text-sm text-neutral-500">No reminders set.</p>
        ) : (
          <ul className="space-y-2">
            {reminders.map((r, idx) => (
              <li
                key={idx}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 p-2"
              >
                <Input
                  type="number"
                  min={1}
                  value={r.value}
                  onChange={(e) =>
                    updateReminder(idx, {
                      value:
                        e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  className="w-20"
                />
                <Select
                  value={r.unit}
                  onChange={(e) =>
                    updateReminder(idx, {
                      unit: e.target.value as ReminderUnit,
                    })
                  }
                  className="w-32"
                >
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </Select>
                <span className="text-sm text-neutral-500">before, in</span>
                <ChannelSelect
                  channels={channels}
                  value={r.channelId}
                  onChange={(id) => updateReminder(idx, { channelId: id })}
                  includeNone
                  noneLabel="same channel"
                  className="w-44"
                />
                <button
                  type="button"
                  onClick={() => removeReminder(idx)}
                  className="ml-auto rounded-lg p-2 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                  aria-label="Remove reminder"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={announceOnCreate}
            onChange={(e) => setAnnounceOnCreate(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-700 bg-neutral-950"
          />
          Post an announcement (with RSVP buttons) as soon as this is saved
        </label>
      </Card>

      {error ? (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending || noChannels}>
          {isPending
            ? "Saving..."
            : mode === "create"
              ? "Create schedule"
              : "Save changes"}
        </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/events")}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
