"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { channelEmoji } from "@/lib/channel-emoji";
import { channelColorOf } from "@/lib/channel-color";

export interface ChannelChoice {
  id: string;
  name: string;
  color?: string | null;
}

interface ChannelSelectProps {
  channels: ChannelChoice[];
  value: string;
  onChange?: (id: string) => void;
  /** When set, a hidden input with this name carries the value for native forms. */
  name?: string;
  includeNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const triggerClass =
  "flex w-full items-center gap-2 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-50";

function ColorBar({ color }: { color: string }) {
  return (
    <span
      className="h-4 w-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

export function ChannelSelect({
  channels,
  value,
  onChange,
  name,
  includeNone = false,
  noneLabel = "None",
  disabled = false,
  id,
  className,
}: ChannelSelectProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setSelected(value), [value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = channels.find((c) => c.id === selected);

  function pick(next: string) {
    setSelected(next);
    onChange?.(next);
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      {name ? <input type="hidden" name={name} value={selected} /> : null}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={triggerClass}
      >
        {current ? (
          <>
            <span className="truncate">
              {channelEmoji(current.name)} #{current.name}
            </span>
            <span className="ml-auto flex items-center gap-2">
              <ColorBar color={channelColorOf(current)} />
              <ChevronDown size={16} className="text-neutral-500" />
            </span>
          </>
        ) : (
          <>
            <span className="truncate text-neutral-400">{noneLabel}</span>
            <ChevronDown size={16} className="ml-auto text-neutral-500" />
          </>
        )}
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--nav))] p-1 shadow-[var(--shadow-card)]">
          {includeNone ? (
            <button
              type="button"
              onClick={() => pick("")}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-300 transition hover:bg-neutral-800"
            >
              <span className="flex-1 truncate">{noneLabel}</span>
              {selected === "" ? (
                <Check size={14} className="text-brand" />
              ) : null}
            </button>
          ) : null}
          {channels.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c.id)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-200 transition hover:bg-neutral-800"
            >
              <span className="flex-1 truncate">
                {channelEmoji(c.name)} #{c.name}
              </span>
              {c.id === selected ? (
                <Check size={14} className="text-brand" />
              ) : null}
              <ColorBar color={channelColorOf(c)} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
