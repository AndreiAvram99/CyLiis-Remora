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

const fieldClass =
  "rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-2 py-1 text-xs text-neutral-200 outline-none focus:border-brand";

interface FileRow {
  id: string;
  name: string;
  priority: string;
  order: number;
  copies: number;
}

export function PrintControls({
  id,
  status,
  files,
}: {
  id: string;
  status: string;
  files: FileRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [st, setSt] = useState(status);
  const [edits, setEdits] = useState<
    Record<string, { priority: string; order: string; copies: string }>
  >(
    Object.fromEntries(
      files.map((f) => [
        f.id,
        { priority: f.priority, order: String(f.order), copies: String(f.copies) },
      ]),
    ),
  );

  const dirty =
    st !== status ||
    files.some((f) => {
      const e = edits[f.id];
      return (
        e &&
        (e.priority !== f.priority ||
          Number(e.order || 0) !== f.order ||
          Math.max(1, Number(e.copies || 1)) !== f.copies)
      );
    });

  function setFile(
    fid: string,
    patch: Partial<{ priority: string; order: string; copies: string }>,
  ) {
    setEdits((m) => ({ ...m, [fid]: { ...m[fid], ...patch } }));
  }

  function save() {
    startTransition(async () => {
      await updatePrintRequest(id, {
        status: st,
        files: files.map((f) => ({
          id: f.id,
          priority: edits[f.id]?.priority ?? f.priority,
          order: Number(edits[f.id]?.order || 0),
          copies: Math.max(1, Number(edits[f.id]?.copies || 1)),
        })),
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Status</span>
        <select
          className={fieldClass}
          value={st}
          onChange={(e) => setSt(e.target.value)}
          disabled={isPending}
        >
          {PRINT_STATUSES.map((v) => (
            <option key={v} value={v}>
              {PRINT_STATUS_EMOJI[v]} {PRINT_STATUS_LABELS[v]}
            </option>
          ))}
        </select>
      </div>

      <ul className="space-y-1.5">
        {files.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-neutral-300">
              {f.name}
            </span>
            <select
              className={fieldClass}
              value={edits[f.id]?.priority ?? f.priority}
              onChange={(e) => setFile(f.id, { priority: e.target.value })}
              disabled={isPending}
              title="Importance"
            >
              {PRINT_PRIORITIES.map((v) => (
                <option key={v} value={v}>
                  {PRINT_PRIORITY_EMOJI[v]} {PRINT_PRIORITY_LABELS[v]}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              className={`${fieldClass} w-14`}
              value={edits[f.id]?.order ?? String(f.order)}
              onChange={(e) => setFile(f.id, { order: e.target.value })}
              disabled={isPending}
              title="Print order (lower prints first)"
            />
            <span className="flex items-center gap-1">
              <span className="text-neutral-500">×</span>
              <input
                type="number"
                min={1}
                className={`${fieldClass} w-14`}
                value={edits[f.id]?.copies ?? String(f.copies)}
                onChange={(e) => setFile(f.id, { copies: e.target.value })}
                disabled={isPending}
                title="Number of pieces to print"
              />
            </span>
          </li>
        ))}
      </ul>

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
