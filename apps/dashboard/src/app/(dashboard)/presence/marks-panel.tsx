"use client";

import { useState, useTransition } from "react";
import { X, Plus } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { addMemberMark, removeMemberMark } from "./actions";

export interface MarkMember {
  id: string;
  name: string;
}

export interface ExistingMark {
  id: string;
  userId: string;
  name: string;
  kind: string;
  reason: string | null;
}

export function MarksPanel({
  members,
  marks,
}: {
  members: MarkMember[];
  marks: ExistingMark[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [kind, setKind] = useState<"BLACK" | "WHITE">("BLACK");
  const [reason, setReason] = useState("");

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      setError("Pick a member first.");
      return;
    }
    run(async () => {
      await addMemberMark(userId, kind, reason);
      setReason("");
    });
  }

  return (
    <div className="space-y-3 border-t border-[rgb(var(--line))] pt-3">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-neutral-500">
          Member
          <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Select…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Mark
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as "BLACK" | "WHITE")}
          >
            <option value="BLACK">Black</option>
            <option value="WHITE">White</option>
          </Select>
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-neutral-500">
          Reason (optional)
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Left early / covered a shift"
          />
        </label>
        <Button type="submit" disabled={isPending}>
          <Plus size={16} /> Add
        </Button>
      </form>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {marks.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Added by hand
          </p>
          <div className="flex flex-wrap gap-2">
            {marks.map((m) => (
              <span
                key={m.id}
                className={`flex max-w-full items-center gap-2 rounded-full border px-2 py-1 text-xs ${
                  m.kind === "WHITE"
                    ? "border-neutral-500/40 bg-neutral-100/10 text-neutral-200"
                    : "border-neutral-700 bg-black text-neutral-200"
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    m.kind === "WHITE" ? "bg-neutral-100" : "bg-neutral-500"
                  }`}
                  aria-hidden
                />
                <span className="min-w-0 truncate">
                  {m.name}
                  {m.reason ? ` — ${m.reason}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => run(() => removeMemberMark(m.id))}
                  disabled={isPending}
                  title="Remove this mark"
                  aria-label={`Remove ${m.kind.toLowerCase()} mark for ${m.name}`}
                  className="shrink-0 rounded-full p-0.5 text-neutral-400 transition hover:bg-neutral-700 hover:text-neutral-100"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
