"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { clearMissedMark, removeMemberMark } from "./actions";

export interface MissedRow {
  eventId: string;
  title: string;
  when: string;
}

export interface ManualRow {
  id: string;
  kind: string;
  reason: string | null;
  when: string;
}

function Bullet({ white }: { white?: boolean }) {
  return (
    <span
      className={`h-3 w-3 shrink-0 rounded-full ring-1 ${
        white ? "bg-white ring-neutral-400" : "bg-black ring-neutral-600"
      }`}
      aria-hidden
    />
  );
}

/**
 * Every mark one member carries, each with a way to take it back. A missed
 * meeting isn't stored as a mark, so removing it means dropping them from that
 * meeting's expected list — the wording says so plainly.
 */
export function MemberMarks({
  userId,
  name,
  missed,
  manual,
}: {
  userId: string;
  name: string;
  missed: MissedRow[];
  manual: ManualRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const Row = ({
    children,
    onRemove,
    label,
  }: {
    children: React.ReactNode;
    onRemove: () => void;
    label: string;
  }) => (
    <div
      className={`flex items-center gap-3 rounded-xl border border-[rgb(var(--line))] bg-neutral-950 px-3 py-2 text-sm ${
        isPending ? "opacity-50" : ""
      }`}
    >
      {children}
      <button
        type="button"
        onClick={onRemove}
        disabled={isPending}
        title={label}
        aria-label={label}
        className="ml-auto shrink-0 rounded-md border border-[rgba(224,92,92,0.28)] p-1 text-[#E56D6D] transition hover:bg-[rgba(229,109,109,0.14)] hover:text-red-400"
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {missed.length === 0 && manual.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {name} has no marks to clear.
        </p>
      ) : null}

      {missed.map((m) => (
        <Row
          key={m.eventId}
          label={`Clear the black mark from ${m.title}`}
          onRemove={() => {
            if (
              !confirm(
                `Clear ${name}'s black mark from "${m.title}"? They'll no longer count as expected at that meeting.`,
              )
            ) {
              return;
            }
            run(() => clearMissedMark(m.eventId, userId));
          }}
        >
          <Bullet />
          <span className="min-w-0">
            <span className="block truncate text-neutral-200">{m.title}</span>
            <span className="text-xs text-neutral-500">
              {m.when} · expected, never answered
            </span>
          </span>
        </Row>
      ))}

      {manual.map((m) => (
        <Row
          key={m.id}
          label="Withdraw this mark"
          onRemove={() => run(() => removeMemberMark(m.id))}
        >
          <Bullet white={m.kind === "WHITE"} />
          <span className="min-w-0">
            <span className="block truncate text-neutral-200">
              {m.reason || `${m.kind === "WHITE" ? "White" : "Black"} mark`}
            </span>
            <span className="text-xs text-neutral-500">
              {m.when} · added by hand
            </span>
          </span>
        </Row>
      ))}
    </div>
  );
}
