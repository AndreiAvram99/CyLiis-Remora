"use client";

import { useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Trash2, UploadCloud } from "lucide-react";
import {
  FILAMENT_TYPES,
  PRINT_COLORS,
  PRINT_DEFAULTS,
  type PrintDefaults,
} from "@repo/shared";
import { Button, Card, Label, Select, Textarea } from "@/components/ui";
import { ChannelSelect } from "@/components/channel-select";
import { createPrintRequest } from "./actions";

interface ChannelOption {
  id: string;
  name: string;
  color?: string | null;
}

interface FileRow {
  id: number;
  file: File;
  copies: number;
  filamentType: string;
  infill: number;
  wallCount: number;
  color: string;
  needsSupport: boolean;
}

function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRINT_COLORS.map((hex) => {
        const active = hex.toUpperCase() === value.toUpperCase();
        return (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(hex)}
            title={hex}
            aria-label={hex}
            aria-pressed={active}
            className={`h-6 w-6 rounded-full border transition ${
              active
                ? "ring-2 ring-brand ring-offset-1 ring-offset-neutral-900"
                : "border-black/20 hover:scale-110"
            }`}
            style={{ backgroundColor: hex }}
          />
        );
      })}
    </div>
  );
}

const MAX_BYTES = 8 * 1024 * 1024;
/** Whole-request ceiling, matching the server action's body limit. */
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
/** Discord's attachments-per-message cap; more than this posts as a follow-up. */
const FILES_PER_MESSAGE = 10;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PrintForm({
  channels,
  defaultChannelId,
  defaults = PRINT_DEFAULTS,
}: {
  channels: ChannelOption[];
  defaultChannelId?: string;
  defaults?: PrintDefaults;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [channelId, setChannelId] = useState(defaultChannelId ?? "");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<FileRow[]>([]);
  const [dragRow, setDragRow] = useState<number | null>(null);
  const nextId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const noChannels = channels.length === 0;

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const added: FileRow[] = Array.from(list).map((file) => ({
      id: nextId.current++,
      file,
      copies: 1,
      ...defaults,
    }));
    setRows((r) => [...r, ...added]);
    setError(null);
  }

  function patch(id: number, p: Partial<Omit<FileRow, "id" | "file">>) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...p } : row)));
  }
  function removeRow(id: number) {
    setRows((r) => r.filter((row) => row.id !== id));
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  }

  // Reorder rows live as one is dragged over another. Print order is the list
  // position: top file prints first.
  function reorder(from: number, to: number) {
    setRows((r) => {
      if (from === to || from < 0 || to < 0 || from >= r.length) return r;
      const next = [...r];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function submit() {
    if (!channelId) return setError("Pick a channel to post in.");
    if (rows.length === 0) return setError("Add at least one file to print.");
    const tooBig = rows.find((r) => r.file.size > MAX_BYTES);
    if (tooBig) {
      return setError(`"${tooBig.file.name}" is larger than 8 MB — Discord won't accept it.`);
    }
    const total = rows.reduce((sum, r) => sum + r.file.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      return setError(
        `That's ${formatSize(total)} in one go — send up to ${formatSize(MAX_TOTAL_BYTES)} per request and split the rest into a second one.`,
      );
    }

    const fd = new FormData();
    fd.set("channelId", channelId);
    fd.set("description", message);
    // Order is the list position — first row prints first.
    rows.forEach((r, i) => {
      fd.append("files", r.file);
      fd.append("order", String(i + 1));
      fd.append("copies", String(r.copies));
      fd.append("filamentType", r.filamentType);
      fd.append("infill", String(r.infill));
      fd.append("wallCount", String(r.wallCount));
      fd.append("color", r.color);
      fd.append("needsSupport", r.needsSupport ? "1" : "0");
    });

    startTransition(async () => {
      const res = await createPrintRequest({ error: null }, fd);
      if (res.ok) {
        router.push("/events");
        router.refresh();
      } else {
        setError(res.error ?? "Something went wrong. Try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <p className="text-sm text-neutral-500">
          Add the file(s) to print, set each one&apos;s 3D settings and drag them
          into print order. We&apos;ll post them to the channel with a button
          teammates can tap to claim the job — no reminders, no RSVP.
        </p>

        <div>
          <Label htmlFor="p-channel">Channel</Label>
          <ChannelSelect
            id="p-channel"
            channels={channels}
            value={channelId}
            onChange={setChannelId}
            disabled={noChannels}
          />
        </div>

        <div className="space-y-3">
          <Label>Files</Label>

          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition ${
              dragActive
                ? "border-brand bg-brand/10"
                : "border-[rgb(var(--line))] bg-[rgb(var(--input))] hover:border-neutral-600"
            }`}
          >
            <UploadCloud
              size={26}
              className={dragActive ? "text-brand" : "text-neutral-500"}
            />
            <div className="text-sm text-neutral-300">
              <span className="font-medium text-brand">Choose files</span> or drag
              and drop them here
            </div>
            <div className="text-xs text-neutral-500">
              Drag files here · max 8 MB each.
            </div>
          </div>

          {rows.length > 0 ? (
            <>
              <p className="text-xs text-neutral-500">
                Drag the rows to set print order — the top file prints first.
                {rows.length > FILES_PER_MESSAGE
                  ? ` ${rows.length} files go out as ${Math.ceil(rows.length / FILES_PER_MESSAGE)} Discord posts — the first one carries the details and the claim button.`
                  : ""}
              </p>
              <ul className="space-y-2">
                {rows.map((row, i) => (
                  <li
                    key={row.id}
                    draggable
                    onDragStart={() => setDragRow(i)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragRow !== null && dragRow !== i) {
                        reorder(dragRow, i);
                        setDragRow(i);
                      }
                    }}
                    onDragEnd={() => setDragRow(null)}
                    className={`space-y-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3 ${
                      dragRow === i ? "opacity-60 ring-1 ring-brand" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-7 shrink-0 cursor-grab items-center justify-center text-neutral-500 active:cursor-grabbing"
                        title="Drag to reorder"
                        aria-label="Drag to reorder"
                      >
                        <span className="mr-1 text-xs font-medium text-neutral-400">
                          {i + 1}
                        </span>
                        <GripVertical size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-neutral-200">
                          {row.file.name}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {formatSize(row.file.size)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-400"
                        aria-label="Remove file"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <Label className="text-xs">Filament</Label>
                        <Select
                          value={row.filamentType}
                          onChange={(e) =>
                            patch(row.id, { filamentType: e.target.value })
                          }
                          aria-label="Filament type"
                        >
                          {FILAMENT_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Infill %</Label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={row.infill}
                          onChange={(e) =>
                            patch(row.id, {
                              infill: Math.max(
                                0,
                                Math.min(100, Number(e.target.value) || 0),
                              ),
                            })
                          }
                          className="w-full rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-3 py-2 text-sm text-neutral-100 outline-none focus:border-brand"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Walls</Label>
                        <input
                          type="number"
                          min={1}
                          value={row.wallCount}
                          onChange={(e) =>
                            patch(row.id, {
                              wallCount: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="w-full rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-3 py-2 text-sm text-neutral-100 outline-none focus:border-brand"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Copies</Label>
                        <input
                          type="number"
                          min={1}
                          value={row.copies}
                          onChange={(e) =>
                            patch(row.id, {
                              copies: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="w-full rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-3 py-2 text-sm text-neutral-100 outline-none focus:border-brand"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Color</Label>
                      <ColorSwatches
                        value={row.color}
                        onChange={(hex) => patch(row.id, { color: hex })}
                      />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-neutral-300">
                      <input
                        type="checkbox"
                        checked={row.needsSupport}
                        onChange={(e) =>
                          patch(row.id, { needsSupport: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-[rgb(var(--line))] bg-[rgb(var(--input))] accent-brand"
                      />
                      Needs support
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <div>
          <Label htmlFor="p-desc">Message (optional)</Label>
          <Textarea
            id="p-desc"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Any notes: quantity, material, color..."
          />
        </div>
      </Card>

      {error ? (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="success"
          onClick={submit}
          disabled={isPending || noChannels}
        >
          {isPending ? "Posting..." : "Post to channel"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/events")}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
