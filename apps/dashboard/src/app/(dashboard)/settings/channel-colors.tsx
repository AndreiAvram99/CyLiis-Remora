"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Card } from "@/components/ui";
import { channelEmoji } from "@/lib/channel-emoji";
import { channelColorOf, defaultChannelColor } from "@/lib/channel-color";
import { setChannelColor } from "./actions";

interface Ch {
  id: string;
  name: string;
  color?: string | null;
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
          Pick a color per channel. It shows as a bar in every channel picker and
          is shared with all admins.
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
            <span
              className="h-4 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: colors[c.id] }}
              aria-hidden
            />
            <input
              type="color"
              value={colors[c.id]}
              disabled={isPending}
              onChange={(e) =>
                setColors((m) => ({ ...m, [c.id]: e.target.value }))
              }
              onBlur={(e) => {
                setExplicit((m) => ({ ...m, [c.id]: true }));
                persist(c.id, e.target.value);
              }}
              className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-[rgb(var(--line))] bg-transparent"
              aria-label={`Color for #${c.name}`}
            />
            {explicit[c.id] ? (
              <button
                type="button"
                title="Reset to default color"
                disabled={isPending}
                onClick={() => {
                  const d = defaultChannelColor(c.name);
                  setColors((m) => ({ ...m, [c.id]: d }));
                  setExplicit((m) => ({ ...m, [c.id]: false }));
                  persist(c.id, null);
                }}
                className="shrink-0 rounded-md p-1.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
              >
                <RotateCcw size={14} />
              </button>
            ) : (
              <span className="w-[30px] shrink-0" />
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
