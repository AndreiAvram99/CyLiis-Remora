"use client";

import { useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UploadCloud } from "lucide-react";
import {
  PRINT_PRIORITIES,
  PRINT_PRIORITY_EMOJI,
  PRINT_PRIORITY_LABELS,
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
  priority: string;
  order: number;
}

const MAX_BYTES = 8 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PrintForm({
  channels,
  defaultChannelId,
}: {
  channels: ChannelOption[];
  defaultChannelId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [channelId, setChannelId] = useState(defaultChannelId ?? "");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<FileRow[]>([]);
  const nextId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const noChannels = channels.length === 0;

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const added: FileRow[] = Array.from(list).map((file) => ({
      id: nextId.current++,
      file,
      priority: "NORMAL",
      order: 0,
    }));
    setRows((r) => [...r, ...added]);
    setError(null);
  }

  function patch(id: number, p: Partial<Pick<FileRow, "priority" | "order">>) {
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

  function submit() {
    if (!channelId) return setError("Pick a channel to post in.");
    if (rows.length === 0) return setError("Add at least one file to print.");
    const tooBig = rows.find((r) => r.file.size > MAX_BYTES);
    if (tooBig) {
      return setError(`"${tooBig.file.name}" is larger than 8 MB — Discord won't accept it.`);
    }

    const fd = new FormData();
    fd.set("channelId", channelId);
    fd.set("description", message);
    for (const r of rows) {
      fd.append("files", r.file);
      fd.append("priority", r.priority);
      fd.append("order", String(r.order));
    }

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
          Add the file(s) to print, each with its own importance and print order.
          We&apos;ll post them to the channel with a button teammates can tap to
          claim the job — no reminders, no RSVP.
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
              Lower order prints first · max 8 MB per file.
            </div>
          </div>

          {rows.length > 0 ? (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-neutral-800 bg-neutral-950 p-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-neutral-200">
                      {row.file.name}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {formatSize(row.file.size)}
                    </div>
                  </div>
                  <Select
                    value={row.priority}
                    onChange={(e) => patch(row.id, { priority: e.target.value })}
                    className="sm:w-36"
                    aria-label="Importance"
                  >
                    {PRINT_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRINT_PRIORITY_EMOJI[p]} {PRINT_PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </Select>
                  <input
                    type="number"
                    min={0}
                    value={row.order}
                    onChange={(e) =>
                      patch(row.id, { order: Number(e.target.value) || 0 })
                    }
                    title="Print order (lower prints first)"
                    aria-label="Print order"
                    className="w-full rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-3 py-2 text-sm text-neutral-100 outline-none focus:border-brand sm:w-20"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="justify-self-end rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-400"
                    aria-label="Remove file"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
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
