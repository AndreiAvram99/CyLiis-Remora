"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PRINT_PRIORITIES,
  PRINT_PRIORITY_EMOJI,
  PRINT_PRIORITY_LABELS,
  PRINT_STATUSES,
  PRINT_STATUS_EMOJI,
  PRINT_STATUS_LABELS,
} from "@repo/shared";
import { updatePrintRequest } from "./actions";

const selectClass =
  "rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-2 py-1 text-xs text-neutral-200 outline-none focus:border-brand";

export function PrintControls({
  id,
  priority,
  order,
  status,
}: {
  id: string;
  priority: string;
  order: number;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [p, setP] = useState(priority);
  const [o, setO] = useState(String(order));
  const [s, setS] = useState(status);

  const dirty =
    p !== priority || s !== status || Number(o || 0) !== order;

  function save() {
    startTransition(async () => {
      await updatePrintRequest(id, {
        priority: p,
        order: Number(o || 0),
        status: s,
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 text-xs text-neutral-500">
        <span className="hidden sm:inline">Importance</span>
        <select
          className={selectClass}
          value={p}
          onChange={(e) => setP(e.target.value)}
          disabled={isPending}
          title="Importance"
        >
          {PRINT_PRIORITIES.map((v) => (
            <option key={v} value={v}>
              {PRINT_PRIORITY_EMOJI[v]} {PRINT_PRIORITY_LABELS[v]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1 text-xs text-neutral-500">
        <span className="hidden sm:inline">Order</span>
        <input
          type="number"
          min={0}
          className={`${selectClass} w-16`}
          value={o}
          onChange={(e) => setO(e.target.value)}
          disabled={isPending}
          title="Print order (lower prints first)"
        />
      </label>

      <label className="flex items-center gap-1 text-xs text-neutral-500">
        <span className="hidden sm:inline">Status</span>
        <select
          className={selectClass}
          value={s}
          onChange={(e) => setS(e.target.value)}
          disabled={isPending}
          title="Status"
        >
          {PRINT_STATUSES.map((v) => (
            <option key={v} value={v}>
              {PRINT_STATUS_EMOJI[v]} {PRINT_STATUS_LABELS[v]}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={save}
        disabled={isPending || !dirty}
        className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-brand-fg transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? "Saving..." : "Save & notify"}
      </button>
    </div>
  );
}
