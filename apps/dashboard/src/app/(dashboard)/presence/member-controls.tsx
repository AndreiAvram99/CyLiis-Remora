"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil, UserMinus } from "lucide-react";
import type { RsvpStatusName } from "@repo/shared";
import { setRsvpStatus, removeRsvp, dropExpectedAttendee } from "./actions";

// Neutral avatar fill — status is shown by the column header, not the avatar.
const AVATAR_NEUTRAL = "bg-neutral-800 text-neutral-300";

/**
 * Answer on someone's behalf who never replied in Discord. Picking a status
 * moves them out of the waiting/missed zone into that group, flagged as
 * admin-adjusted like any other override.
 */
export function AssignStatus({
  eventId,
  userId,
}: {
  eventId: string;
  userId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function assign(next: RsvpStatusName) {
    startTransition(async () => {
      await setRsvpStatus(eventId, userId, next);
      router.refresh();
    });
  }

  return (
    <select
      value=""
      disabled={isPending}
      onChange={(e) => {
        if (e.target.value) assign(e.target.value as RsvpStatusName);
      }}
      title="Answer for them"
      className={`shrink-0 rounded-md border border-red-500/40 bg-neutral-900 px-1 py-0.5 text-xs text-neutral-200 outline-none focus:border-brand ${
        isPending ? "opacity-50" : ""
      }`}
    >
      <option value="">Set…</option>
      <option value="GOING">Going</option>
      <option value="MOTIVATED">Motivation</option>
    </select>
  );
}

/**
 * Take someone off a meeting's expected list when it turns out they don't need
 * to be there. The roll-call in Discord is rewritten to match.
 */
export function DropExpected({
  eventId,
  userId,
  name,
}: {
  eventId: string;
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function drop() {
    if (!confirm(`${name} is no longer expected at this meeting?`)) return;
    startTransition(async () => {
      await dropExpectedAttendee(eventId, userId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={drop}
      disabled={isPending}
      className={`shrink-0 rounded-md border border-neutral-700 p-1 text-neutral-400 transition hover:border-neutral-500 hover:text-neutral-100 ${
        isPending ? "opacity-50" : ""
      }`}
      aria-label="Not expected"
      title="Not expected at this meeting"
    >
      <UserMinus size={13} strokeWidth={2.5} />
    </button>
  );
}

export function EditableMember({
  eventId,
  userId,
  name,
  avatarUrl,
  status,
  overridden,
}: {
  eventId: string;
  userId: string;
  name: string;
  avatarUrl?: string | null;
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
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${AVATAR_NEUTRAL}`}
        >
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
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
        <option value="MOTIVATED">Motivation</option>
      </select>
      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        className="shrink-0 rounded-md border border-[rgba(224,92,92,0.28)] p-1 text-[#E56D6D] transition hover:bg-[rgba(229,109,109,0.14)] hover:text-red-400"
        aria-label="Remove"
        title="Remove"
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </span>
  );
}
