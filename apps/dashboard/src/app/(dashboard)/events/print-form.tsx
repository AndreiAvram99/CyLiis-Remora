"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  PRINT_PRIORITIES,
  PRINT_PRIORITY_EMOJI,
  PRINT_PRIORITY_LABELS,
} from "@repo/shared";
import { Button, Card, Label, Select, Textarea } from "@/components/ui";
import { ChannelSelect } from "@/components/channel-select";
import { createPrintRequest, type PrintFormState } from "./actions";

interface ChannelOption {
  id: string;
  name: string;
  color?: string | null;
}

const fileInputClass =
  "block w-full cursor-pointer rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-3 py-2 text-sm text-neutral-300 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-fg hover:file:brightness-95";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="success" disabled={pending}>
      {pending ? "Posting..." : "Post to channel"}
    </Button>
  );
}

export function PrintForm({
  channels,
  defaultChannelId,
}: {
  channels: ChannelOption[];
  defaultChannelId?: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState<PrintFormState, FormData>(
    createPrintRequest,
    { error: null },
  );
  // Each row is one file with its own importance + order. Track ids for add/remove.
  const [rows, setRows] = useState<number[]>([0]);
  const [nextId, setNextId] = useState(1);

  useEffect(() => {
    if (state.ok) {
      router.push("/events");
      router.refresh();
    }
  }, [state.ok, router]);

  const noChannels = channels.length === 0;

  function addRow() {
    setRows((r) => [...r, nextId]);
    setNextId((n) => n + 1);
  }
  function removeRow(id: number) {
    setRows((r) => (r.length > 1 ? r.filter((x) => x !== id) : r));
  }

  return (
    <form action={action} className="space-y-6">
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
            name="channelId"
            channels={channels}
            value={defaultChannelId ?? ""}
            disabled={noChannels}
          />
        </div>

        <div className="space-y-2">
          <Label>Files</Label>
          <ul className="space-y-2">
            {rows.map((id) => (
              <li
                key={id}
                className="grid grid-cols-1 gap-2 rounded-lg border border-neutral-800 bg-neutral-950 p-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
              >
                <input
                  type="file"
                  name="files"
                  className={fileInputClass}
                  aria-label="File to print"
                />
                <Select
                  name="priority"
                  defaultValue="NORMAL"
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
                  name="order"
                  min={0}
                  defaultValue={0}
                  title="Print order (lower prints first)"
                  aria-label="Print order"
                  className="w-full rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-3 py-2 text-sm text-neutral-100 outline-none focus:border-brand sm:w-20"
                />
                <button
                  type="button"
                  onClick={() => removeRow(id)}
                  disabled={rows.length === 1}
                  className="justify-self-end rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-400 disabled:opacity-30"
                  aria-label="Remove file"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <Button type="button" variant="secondary" onClick={addRow}>
              <Plus size={16} /> Add file
            </Button>
            <span className="text-xs text-neutral-500">
              Lower order prints first · max 8 MB per file.
            </span>
          </div>
        </div>

        <div>
          <Label htmlFor="p-desc">Message (optional)</Label>
          <Textarea
            id="p-desc"
            name="description"
            rows={3}
            placeholder="Any notes: quantity, material, color..."
          />
        </div>
      </Card>

      {state.error ? (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <SubmitButton />
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/events")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
