/**
 * Mark badges. The bullet carries the meaning — solid black for a penalty,
 * solid white for a credit — so the two never read as each other. A star is
 * the standout, worth five white marks.
 */

import { Star } from "lucide-react";
import { STAR_WHITE_VALUE } from "@repo/shared";

const BADGE =
  "flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold text-neutral-200 ring-1 ring-neutral-700";

export function BlackMark({ count }: { count: number }) {
  return (
    <span
      title={`${count} black mark${count === 1 ? "" : "s"}`}
      className={BADGE}
    >
      <span
        className="h-3 w-3 rounded-full bg-black ring-1 ring-neutral-600"
        aria-hidden
      />
      {count}
    </span>
  );
}

export function WhiteMark({ count }: { count: number }) {
  return (
    <span
      title={`${count} white mark${count === 1 ? "" : "s"}`}
      className={BADGE}
    >
      <span
        className="h-3 w-3 rounded-full bg-white ring-1 ring-neutral-400"
        aria-hidden
      />
      {count}
    </span>
  );
}

/** The mark itself, at bullet size, for listing marks one by one. */
export function MarkBullet({ kind }: { kind: string }) {
  if (kind === "STAR") {
    return (
      <Star
        size={14}
        className="shrink-0 fill-palette-sun text-palette-sun"
        aria-hidden
      />
    );
  }
  return (
    <span
      className={`h-3 w-3 shrink-0 rounded-full ring-1 ${
        kind === "WHITE"
          ? "bg-white ring-neutral-400"
          : "bg-black ring-neutral-600"
      }`}
      aria-hidden
    />
  );
}

export function StarMark({ count }: { count: number }) {
  return (
    <span
      title={`${count} star${count === 1 ? "" : "s"} · worth ${
        count * STAR_WHITE_VALUE
      } white marks`}
      className={`${BADGE} ring-palette-sun/40`}
    >
      <Star
        size={12}
        className="fill-palette-sun text-palette-sun"
        aria-hidden
      />
      {count}
    </span>
  );
}
