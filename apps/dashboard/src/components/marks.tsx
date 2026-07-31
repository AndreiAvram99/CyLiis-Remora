/**
 * Mark badges. The bullet carries the meaning — solid black for a penalty,
 * solid white for a credit — so the two never read as each other.
 */

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
