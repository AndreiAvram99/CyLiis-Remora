"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { channelEmoji } from "@/lib/channel-emoji";
import { createPrintRequest, type PrintFormState } from "./actions";

interface ChannelOption {
  id: string;
  name: string;
}

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

  // On a successful post, head back to the schedules list.
  useEffect(() => {
    if (state.ok) {
      router.push("/events");
      router.refresh();
    }
  }, [state.ok, router]);

  const noChannels = channels.length === 0;

  return (
    <form action={action} className="space-y-6">
      <Card className="space-y-4">
        <p className="text-sm text-neutral-500">
          Upload the file(s) to print. We&apos;ll post them to the channel with a
          button teammates can tap to claim the job — no reminders, no RSVP.
        </p>

        <div>
          <Label htmlFor="p-title">What needs printing?</Label>
          <Input
            id="p-title"
            name="title"
            required
            placeholder="Robot mount bracket v3"
          />
        </div>

        <div>
          <Label htmlFor="p-channel">Channel</Label>
          <Select
            id="p-channel"
            name="channelId"
            defaultValue={defaultChannelId}
            disabled={noChannels}
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {channelEmoji(c.name)} #{c.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="p-files">File(s)</Label>
          <input
            id="p-files"
            name="files"
            type="file"
            multiple
            required
            className="block w-full cursor-pointer rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-3 py-2.5 text-sm text-neutral-300 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-fg hover:file:brightness-95"
          />
          <p className="mt-1 text-xs text-neutral-500">Max 8 MB per file.</p>
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
