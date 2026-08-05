"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  ListChecks,
  CalendarRange,
  Users,
  Trophy,
  Instagram,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  managerOnly: boolean;
};

const NAV_ITEMS: Item[] = [
  { href: "/events", label: "Schedules", icon: ListChecks, managerOnly: false },
  { href: "/instagram", label: "Instagram", icon: Instagram, managerOnly: false },
  { href: "/calendar", label: "Calendar", icon: CalendarRange, managerOnly: false },
  { href: "/presence", label: "Presence", icon: Users, managerOnly: false },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, managerOnly: false },
  { href: "/help", label: "Help", icon: LifeBuoy, managerOnly: false },
];

/** Phone-only hamburger that opens a left drawer sliding in from the left. */
export function MobileNav({ isManager }: { isManager: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => !i.managerOnly || isManager);

  // Close on route change, lock body scroll + close on Escape while open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 transition hover:bg-neutral-800 hover:text-neutral-100"
      >
        <Menu size={20} />
      </button>

      {/* Overlay + sliding panel. Always mounted so it can animate. */}
      <div
        className={cn(
          "fixed inset-0 z-50",
          open ? "" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex w-72 max-w-[82%] flex-col border-r border-[rgb(var(--line))] bg-[rgb(var(--nav))] shadow-[var(--shadow-card)] transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <Link
              href="/events"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-neutral-100"
            >
              <Image src="/logo.png" alt="CyLiis Remora" width={30} height={30} />
              <span>CyLiis Remora</span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex flex-col gap-1 px-3 py-2">
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                    active
                      ? "bg-neutral-800 text-neutral-100"
                      : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100",
                  )}
                >
                  <item.icon
                    size={18}
                    className={active ? "text-brand" : ""}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
