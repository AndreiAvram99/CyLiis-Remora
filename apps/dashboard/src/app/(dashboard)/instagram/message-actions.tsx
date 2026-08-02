"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { deleteMessage, markMessageRead } from "./actions";

const ICON_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50";

export function MessageActions({ id, read }: { id: string; read: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {read ? null : (
        <button
          type="button"
          onClick={() => run(() => markMessageRead(id))}
          disabled={isPending}
          title="Mark as read"
          aria-label="Mark as read"
          className={`${ICON_BUTTON} border-[rgba(32,158,219,0.30)] text-brand hover:bg-neutral-800`}
        >
          <Check size={15} />
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (!confirm("Delete this message? It's removed from Discord too."))
            return;
          run(() => deleteMessage(id));
        }}
        disabled={isPending}
        title="Delete"
        aria-label="Delete"
        className={`${ICON_BUTTON} border-[rgba(224,92,92,0.28)] text-[#E56D6D] hover:bg-[rgba(229,109,109,0.10)]`}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
