"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FILAMENT_TYPES,
  PRINT_COLORS,
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
  order: number;
  copies: number;
  filamentType: string;
  infill: number;
  wallCount: number;
  color: string;
  needsSupport: boolean;
}

interface Edit {
  order: string;
  copies: string;
  filamentType: string;
  infill: string;
  wallCount: string;
  color: string;
  needsSupport: boolean;
}

function toEdit(f: FileRow): Edit {
  return {
    order: String(f.order),
    copies: String(f.copies),
    filamentType: f.filamentType,
    infill: String(f.infill),
    wallCount: String(f.wallCount),
    color: f.color,
    needsSupport: f.needsSupport,
  };
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
  const [edits, setEdits] = useState<Record<string, Edit>>(
    Object.fromEntries(files.map((f) => [f.id, toEdit(f)])),
  );

  const dirty =
    st !== status ||
    files.some((f) => {
      const e = edits[f.id];
      if (!e) return false;
      return (
        Number(e.order || 0) !== f.order ||
        Math.max(1, Number(e.copies || 1)) !== f.copies ||
        e.filamentType !== f.filamentType ||
        Number(e.infill || 0) !== f.infill ||
        Math.max(1, Number(e.wallCount || 1)) !== f.wallCount ||
        e.color.toUpperCase() !== f.color.toUpperCase() ||
        e.needsSupport !== f.needsSupport
      );
    });

  function setFile(fid: string, patch: Partial<Edit>) {
    setEdits((m) => ({ ...m, [fid]: { ...m[fid], ...patch } }));
  }

  function save() {
    startTransition(async () => {
      await updatePrintRequest(id, {
        status: st,
        files: files.map((f) => {
          const e = edits[f.id] ?? toEdit(f);
          return {
            id: f.id,
            order: Number(e.order || 0),
            copies: Math.max(1, Number(e.copies || 1)),
            filamentType: e.filamentType,
            infill: Math.max(0, Math.min(100, Number(e.infill || 0))),
            wallCount: Math.max(1, Number(e.wallCount || 1)),
            color: e.color,
            needsSupport: e.needsSupport,
          };
        }),
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
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

      <ul className="space-y-2">
        {files.map((f) => {
          const e = edits[f.id] ?? toEdit(f);
          return (
            <li
              key={f.id}
              className="space-y-2 rounded-md border border-[rgb(var(--line))] p-2 text-xs"
            >
              <div className="truncate text-neutral-300">{f.name}</div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1">
                  <span className="text-neutral-500">Filament</span>
                  <select
                    className={fieldClass}
                    value={e.filamentType}
                    onChange={(ev) =>
                      setFile(f.id, { filamentType: ev.target.value })
                    }
                    disabled={isPending}
                  >
                    {FILAMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-neutral-500">Infill %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={`${fieldClass} w-14`}
                    value={e.infill}
                    onChange={(ev) => setFile(f.id, { infill: ev.target.value })}
                    disabled={isPending}
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-neutral-500">Walls</span>
                  <input
                    type="number"
                    min={1}
                    className={`${fieldClass} w-12`}
                    value={e.wallCount}
                    onChange={(ev) =>
                      setFile(f.id, { wallCount: ev.target.value })
                    }
                    disabled={isPending}
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-neutral-500">×</span>
                  <input
                    type="number"
                    min={1}
                    className={`${fieldClass} w-12`}
                    value={e.copies}
                    onChange={(ev) => setFile(f.id, { copies: ev.target.value })}
                    disabled={isPending}
                    title="Copies"
                  />
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={e.needsSupport}
                    onChange={(ev) =>
                      setFile(f.id, { needsSupport: ev.target.checked })
                    }
                    disabled={isPending}
                    className="h-3.5 w-3.5 accent-brand"
                  />
                  <span className="text-neutral-500">Support</span>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {PRINT_COLORS.map((hex) => {
                  const active = hex.toUpperCase() === e.color.toUpperCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      disabled={isPending}
                      onClick={() => setFile(f.id, { color: hex })}
                      title={hex}
                      aria-label={hex}
                      className={`h-5 w-5 rounded-full border transition ${
                        active
                          ? "ring-2 ring-brand ring-offset-1 ring-offset-[rgb(var(--card))]"
                          : "border-black/20 hover:scale-110"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  );
                })}
              </div>
            </li>
          );
        })}
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
