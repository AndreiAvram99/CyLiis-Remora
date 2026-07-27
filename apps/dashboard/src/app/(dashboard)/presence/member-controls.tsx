"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil } from "lucide-react";
import type { RsvpStatusName } from "@repo/shared";
import { setRsvpStatus, removeRsvp } from "./actions";

// Neutral avatar fill — status is shown by the column header, not the avatar.
const AVATAR_NEUTRAL = "bg-neutral-800 text-neutral-300";

export function EditableMember({
  eventId,
  userId,
  name,
  status,
  overridden,
}: {
  eventId: string;
  userId: string;
  name: string;
  status: RsvpStatusName;
  overridden: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function change(next: RsvpStatusName) {
    if (next === status) return;
    startTransition(async () => {
      await setRsvpStatus(eventId, userId, next);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await removeRsvp(eventId, userId);
      router.refresh();
    });
  }

  return (
    <span
      className={`flex max-w-full items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 py-1 pl-1 pr-1.5 text-sm ${isPending ? "opacity-50" : ""}`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${AVATAR_NEUTRAL}`}
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0 max-w-[10rem] truncate">{name}</span>
      {overridden ? (
        <Pencil
          size={11}
          className="shrink-0 text-palette-sun"
          aria-label="Adjusted by admin"
        />
      ) : null}
      <select
        value={status}
        disabled={isPending}
        onChange={(e) => change(e.target.value as RsvpStatusName)}
        className="shrink-0 rounded-md border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-xs text-neutral-200 outline-none focus:border-brand"
        title="Change status"
      >
        <option value="GOING">Going</option>
        <option value="NO">Can&apos;t make it</option>
        <option value="MOTIVATED">Motivation</option>
      </select>
      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        className="shrink-0 rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
        aria-label="Remove"
      >
        <X size={13} />
      </button>
    </span>
  );
}
