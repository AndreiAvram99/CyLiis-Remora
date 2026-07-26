"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil } from "lucide-react";
import type { RsvpStatusName } from "@repo/shared";
import { setRsvpStatus, removeRsvp } from "./actions";

const AVATAR_COLORS = [
  "bg-rose-500/20 text-rose-300",
  "bg-amber-500/20 text-amber-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-sky-500/20 text-sky-300",
  "bg-violet-500/20 text-violet-300",
  "bg-teal-500/20 text-teal-300",
];

function colorFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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
      className={`flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 py-1 pl-1 pr-1.5 text-sm ${isPending ? "opacity-50" : ""}`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${colorFor(userId)}`}
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
      <span className="max-w-[10rem] truncate">{name}</span>
      {overridden ? (
        <Pencil size={11} className="text-amber-400" aria-label="Adjusted by admin" />
      ) : null}
      <select
        value={status}
        disabled={isPending}
        onChange={(e) => change(e.target.value as RsvpStatusName)}
        className="rounded-md border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-xs text-neutral-200 outline-none focus:border-brand"
        title="Change status"
      >
        <option value="GOING">Going</option>
        <option value="INTERESTED">Interested</option>
        <option value="NO">Can&apos;t</option>
      </select>
      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
        aria-label="Remove"
      >
        <X size={13} />
      </button>
    </span>
  );
}
