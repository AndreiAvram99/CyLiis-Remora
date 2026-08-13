"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LifeBuoy, LogOut, Settings, User } from "lucide-react";
import { Avatar } from "@/components/personalization";

const ITEM =
  "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-neutral-200 transition hover:bg-neutral-800";

/**
 * The avatar opens what belongs to the person rather than to the schedule: their
 * own profile, the server's settings when they're allowed to change them, how
 * any of it works, and the way out. Keeping them together leaves the bar for
 * the team's pages.
 */
export function UserMenu({
  name,
  avatarUrl,
  isManager,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  isManager: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center rounded-lg px-1.5 py-1 transition hover:bg-neutral-800"
      >
        <Avatar name={name} src={avatarUrl} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-[rgb(var(--line))] bg-neutral-900 p-1.5 shadow-[var(--shadow-card)]"
        >
          {name ? (
            <p className="truncate px-2 pb-1.5 pt-1 text-xs text-neutral-500">
              {name}
            </p>
          ) : null}
          <Link href="/account" onClick={() => setOpen(false)} className={ITEM}>
            <User size={16} className="shrink-0" />
            Profile
          </Link>
          {isManager ? (
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className={ITEM}
            >
              <Settings size={16} className="shrink-0" />
              Server settings
            </Link>
          ) : null}
          <Link href="/help" onClick={() => setOpen(false)} className={ITEM}>
            <LifeBuoy size={16} className="shrink-0" />
            How Remora works
          </Link>
          <div className="my-1 border-t border-[rgb(var(--line))]" />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={`${ITEM} w-full text-left`}
          >
            <LogOut size={16} className="shrink-0" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
