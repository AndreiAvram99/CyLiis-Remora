"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  fromOffsetMinutes,
  toOffsetMinutes,
  type EventKindName,
  type ReminderUnit,
} from "@repo/shared";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { updateSettings } from "./actions";

interface ChannelOption {
  id: string;
  name: string;
}

interface Row {
  value: number;
  unit: ReminderUnit;
}

const KINDS: { key: EventKindName; label: string; hint: string }[] = [
  { key: "MEETING", label: "Meetings", hint: "usually minutes / hours" },
  { key: "EVENT", label: "Events", hint: "usually days" },
  { key: "CUSTOM", label: "Custom", hint: "anything" },
];

const COMMON_TIMEZONES = [
  "Europe/Bucharest",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "UTC",
];

function toRows(offsets: number[]): Row[] {
  return offsets.map((o) => {
    const { value, unit } = fromOffsetMinutes(o);
    return { value, unit };
  });
}

export function SettingsForm({
  timezone,
  defaultChannelId,
  channels,
  defaults,
}: {
  timezone: string;
  defaultChannelId: string | null;
  channels: ChannelOption[];
  defaults: Record<EventKindName, number[]>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tz, setTz] = useState(timezone);
  const [channelId, setChannelId] = useState(defaultChannelId ?? "");
  const [rows, setRows] = useState<Record<EventKindName, Row[]>>({
    MEETING: toRows(defaults.MEETING),
    EVENT: toRows(defaults.EVENT),
    CUSTOM: toRows(defaults.CUSTOM),
  });

  function update(kind: EventKindName, idx: number, patch: Partial<Row>) {
    setRows((prev) => ({
      ...prev,
      [kind]: prev[kind].map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  }

  function add(kind: EventKindName) {
    const preset: Row =
      kind === "EVENT"
        ? { value: 1, unit: "days" }
        : { value: 15, unit: "minutes" };
    setRows((prev) => ({ ...prev, [kind]: [...prev[kind], preset] }));
  }

  function remove(kind: EventKindName, idx: number) {
    setRows((prev) => ({
      ...prev,
      [kind]: prev[kind].filter((_, i) => i !== idx),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const flat = (Object.keys(rows) as EventKindName[]).flatMap((kind) =>
      rows[kind].map((r) => ({
        kind,
        offsetMinutes: toOffsetMinutes(Number(r.value) || 0, r.unit),
      })),
    );

    startTransition(async () => {
      try {
        await updateSettings({
          timezone: tz,
          defaultChannelId: channelId || null,
          defaults: flat,
        });
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tz">Timezone</Label>
            <Select id="tz" value={tz} onChange={(e) => setTz(e.target.value)}>
              {(COMMON_TIMEZONES.includes(tz)
                ? COMMON_TIMEZONES
                : [tz, ...COMMON_TIMEZONES]
              ).map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="default-channel">Default channel</Label>
            <Select
              id="default-channel"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            >
              <option value="">None</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {KINDS.map(({ key, label, hint }) => (
        <Card key={key} className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">{label} default reminders</h2>
              <p className="text-xs text-neutral-500">{hint}</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => add(key)}>
              <Plus size={16} /> Add
            </Button>
          </div>
          {rows[key].length === 0 ? (
            <p className="text-sm text-neutral-500">No defaults.</p>
          ) : (
            <ul className="space-y-2">
              {rows[key].map((r, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={r.value}
                    onChange={(e) =>
                      update(key, idx, { value: Number(e.target.value) })
                    }
                    className="w-20"
                  />
                  <Select
                    value={r.unit}
                    onChange={(e) =>
                      update(key, idx, { unit: e.target.value as ReminderUnit })
                    }
                    className="w-32"
                  >
                    <option value="minutes">minutes</option>
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </Select>
                  <span className="text-sm text-neutral-500">before</span>
                  <button
                    type="button"
                    onClick={() => remove(key, idx)}
                    className="ml-auto rounded-lg p-2 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                    aria-label="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}

      {error ? (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save settings"}
        </Button>
        {saved ? (
          <span className="text-sm text-emerald-400">Saved.</span>
        ) : null}
      </div>
    </form>
  );
}
