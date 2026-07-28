"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  fromOffsetMinutes,
  toOffsetMinutes,
  type EventKindName,
  type ReminderUnit,
} from "@repo/shared";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { ChannelSelect } from "@/components/channel-select";
import { createEvent, updateEvent } from "./actions";
import { PrintForm } from "./print-form";

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
  location: string;
  url: string;
  channelId: string;
  announceOnCreate: boolean;
  reminders: Array<{ offsetMinutes: number; channelId: string | null }>;
}

interface EventFormProps {
  mode: "create" | "edit";
  eventId?: string;
  channels: ChannelOption[];
  kindDefaults: Record<EventKindName, number[]>;
  defaultChannelId?: string | null;
  initial?: EventFormInitial;
}

const KIND_LABELS: Record<EventKindName, string> = {
  MEETING: "Meeting",
  EVENT: "Event",
  CUSTOM: "Custom",
};

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
  initial,
}: EventFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [kind, setKind] = useState<FormKind>(initial?.kind ?? "EVENT");
  const [startAt, setStartAt] = useState(initial?.startAt ?? "");
  const [endAt, setEndAt] = useState(initial?.endAt ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [channelId, setChannelId] = useState(
    initial?.channelId ?? defaultChannelId ?? channels[0]?.id ?? "",
  );
  const [announceOnCreate, setAnnounceOnCreate] = useState(
    initial?.announceOnCreate ?? true,
  );
  const [reminders, setReminders] = useState<ReminderRow[]>(
    initial
      ? initial.reminders.map((r) => {
          const { value, unit } = fromOffsetMinutes(r.offsetMinutes);
          return { value, unit, channelId: r.channelId ?? "" };
        })
      : offsetsToRows(kindDefaults.EVENT ?? []),
  );

  function handleKindChange(next: FormKind) {
    setKind(next);
    // In create mode, load that kind's default reminders as a starting point.
    // PRINT has none (it uses its own simple form).
    if (mode === "create" && next !== "PRINT") {
      setReminders(offsetsToRows(kindDefaults[next] ?? []));
    }
  }

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
      endAt: endAt || null,
      location: location.trim() || null,
      url: url.trim() || null,
      channelId,
      announceOnCreate,
      reminders: reminders.map((r) => ({
        offsetMinutes: toOffsetMinutes(Number(r.value), r.unit),
        channelId: r.channelId || null,
      })),
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

      <Card className="space-y-2">
        <div>
          <Label htmlFor="kind">Type</Label>
          <Select
            id="kind"
            value={kind}
            onChange={(e) => handleKindChange(e.target.value as FormKind)}
          >
            {(Object.keys(KIND_LABELS) as EventKindName[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
            {mode === "create" ? (
              <option value="PRINT">Printing</option>
            ) : null}
          </Select>
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
            <Label htmlFor="endAt">Ends (optional)</Label>
            <Input
              id="endAt"
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </div>
        </div>

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
