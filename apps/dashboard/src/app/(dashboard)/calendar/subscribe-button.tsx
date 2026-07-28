"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Apple, Check, Copy, ExternalLink } from "lucide-react";

/**
 * "Subscribe" menu that hands the app's ICS feed to whatever calendar the user
 * has. webcal:// opens Apple Calendar / Outlook (and iOS/macOS) straight into a
 * subscribe prompt; the Google link opens its add-by-URL screen; and there's a
 * copy button for Android / manual "add from URL" flows.
 */
export function SubscribeButton({ feedUrl }: { feedUrl: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const webcalUrl = feedUrl.replace(/^https?:\/\//, "webcal://");
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(
    webcalUrl,
  )}`;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 transition hover:bg-neutral-700"
      >
        <CalendarPlus size={16} /> Subscribe
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-[rgb(var(--line))] bg-neutral-900 p-2 shadow-xl">
          <p className="px-2 pb-1.5 pt-1 text-xs text-neutral-500">
            Add CyLiis Remora to your calendar. It stays in sync automatically.
          </p>
          <a
            href={webcalUrl}
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-neutral-200 transition hover:bg-neutral-800"
          >
            <Apple size={16} className="shrink-0" />
            Apple Calendar / iPhone
          </a>
          <a
            href={googleUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-neutral-200 transition hover:bg-neutral-800"
          >
            <ExternalLink size={16} className="shrink-0" />
            Google Calendar
          </a>
          <button
            type="button"
            onClick={copy}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-neutral-200 transition hover:bg-neutral-800"
          >
            {copied ? (
              <Check size={16} className="shrink-0 text-palette-azure" />
            ) : (
              <Copy size={16} className="shrink-0" />
            )}
            {copied ? "Link copied" : "Copy link (Android / other)"}
          </button>
          <p className="px-2 pb-1 pt-1.5 text-[11px] leading-snug text-neutral-500">
            On Android, open Google Calendar → Settings → Add calendar → From
            URL, and paste the copied link.
          </p>
        </div>
      ) : null}
    </div>
  );
}
