"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Header nav item: muted until active, blue underline when active. The icon is
 * passed as children (rendered on the server) so we don't serialize a component
 * across the boundary; it inherits `currentColor`, so it brightens when active.
 */
export function NavLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition focus-visible:bg-neutral-800",
        active
          ? "text-neutral-100"
          : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200",
      )}
    >
      {/* Icon is muted with the text, but turns primary-blue when active. */}
      <span className={active ? "text-brand" : ""}>{children}</span>
      {label}
      {active ? (
        <span className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-brand" />
      ) : null}
    </Link>
  );
}
