"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECONDARY_NAV, visibleTo } from "@/lib/nav";

/**
 * The pages that aren't part of the weekly routine. Folding them into one
 * control keeps the header short enough to read at a glance, and the trigger
 * still lights up while you're on one of them.
 */
export function MoreMenu({ isManager }: { isManager: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const items = visibleTo(SECONDARY_NAV, isManager);
  const active = items.find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );

  useEffect(() => setOpen(false), [pathname]);
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
        className={cn(
          "relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition focus-visible:bg-neutral-800",
          active
            ? "text-neutral-100"
            : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200",
        )}
      >
        {active ? (
          <span className="text-brand">
            <active.icon size={16} />
          </span>
        ) : null}
        {active ? active.label : "More"}
        <ChevronDown
          size={14}
          className={cn("transition-transform", open ? "rotate-180" : "")}
        />
        {active ? (
          <span className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-brand" />
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-2 w-56 rounded-xl border border-[rgb(var(--line))] bg-neutral-900 p-1.5 shadow-[var(--shadow-card)]"
        >
          {items.map((item) => {
            const on = item.href === active?.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition hover:bg-neutral-800",
                  on ? "text-neutral-100" : "text-neutral-300",
                )}
              >
                <item.icon
                  size={16}
                  className={cn("shrink-0", on ? "text-brand" : "")}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
