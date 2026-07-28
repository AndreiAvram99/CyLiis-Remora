"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { Card } from "@/components/ui";
import { channelEmoji } from "@/lib/channel-emoji";
import {
  channelColorOf,
  defaultChannelColor,
  CHANNEL_PALETTE,
} from "@/lib/channel-color";
import { setChannelColor } from "./actions";

interface Ch {
  id: string;
  name: string;
  color?: string | null;
}

/** Per-channel color picker: curated swatches + a custom hex + reset to default. */
function ColorPopover({
  value,
  isDefault,
  disabled,
  onPick,
  onDefault,
}: {
  value: string;
  isDefault: boolean;
  disabled: boolean;
  onPick: (hex: string) => void;
  onDefault: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="h-7 w-7 rounded-full border border-black/20 ring-1 ring-[rgb(var(--line))] transition hover:scale-105 disabled:opacity-50"
        style={{ backgroundColor: value }}
        aria-label="Pick color"
        title="Pick color"
      />
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-[rgb(var(--line))] bg-neutral-900 p-3 shadow-xl">
          <div className="mb-2 flex items-center gap-2">
            <label
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[rgb(var(--line))] text-neutral-400 transition hover:text-neutral-100"
              title="Custom color"
            >
              <Pencil size={13} />
              <input
                ref={customRef}
                type="color"
                value={value}
                onChange={(e) => onPick(e.target.value)}
                className="h-0 w-0 opacity-0"
              />
            </label>
            <span className="text-xs text-neutral-500">Custom</span>
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {CHANNEL_PALETTE.map((hex) => {
              const active = hex.toUpperCase() === value.toUpperCase();
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onPick(hex)}
                  title={hex}
                  aria-label={hex}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-black/20 transition hover:scale-110"
                  style={{ backgroundColor: hex }}
                >
                  {active ? (
                    <Check size={13} className="text-white drop-shadow" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onDefault}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--input))] py-2 text-sm text-neutral-200 transition hover:bg-neutral-800"
          >
            {isDefault ? (
              <Check size={15} className="text-palette-azure" />
            ) : null}
            Default
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ChannelColorEditor({ channels }: { channels: Ch[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [colors, setColors] = useState<Record<string, string>>(
    Object.fromEntries(channels.map((c) => [c.id, channelColorOf(c)])),
  );
  const [explicit, setExplicit] = useState<Record<string, boolean>>(
    Object.fromEntries(channels.map((c) => [c.id, Boolean(c.color)])),
  );

  function persist(id: string, color: string | null) {
    startTransition(async () => {
      await setChannelColor(id, color);
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Channel colors</h2>
        <p className="text-xs text-neutral-500">
          Pick a color per channel. It shows as a bar in every channel picker,
          tints its schedules on the calendar, and is shared with all admins.
        </p>
      </div>
      <ul className="space-y-2">
        {channels.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm">
              {channelEmoji(c.name)} #{c.name}
            </span>
            <ColorPopover
              value={colors[c.id]}
              isDefault={!explicit[c.id]}
              disabled={isPending}
              onPick={(hex) => {
                setColors((m) => ({ ...m, [c.id]: hex }));
                setExplicit((m) => ({ ...m, [c.id]: true }));
                persist(c.id, hex);
              }}
              onDefault={() => {
                const d = defaultChannelColor(c.name);
                setColors((m) => ({ ...m, [c.id]: d }));
                setExplicit((m) => ({ ...m, [c.id]: false }));
                persist(c.id, null);
              }}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
