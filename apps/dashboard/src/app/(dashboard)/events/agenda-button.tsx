"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui";
import { createAgendaDoc } from "./actions";

/**
 * Makes the meeting's agenda document, or links to it once it exists. Recurring
 * meetings reuse one document, so this only ever adds the occurrence's tabs.
 */
export function AgendaButton({
  id,
  docUrl,
}: {
  id: string;
  docUrl: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (docUrl) {
    return (
      <a
        href={docUrl}
        target="_blank"
        rel="noreferrer"
        title="Open agenda"
        aria-label="Open agenda"
      >
        <Button variant="secondary" className="w-11 px-0 sm:w-auto sm:px-5">
          <FileText size={16} />
          <span className="hidden sm:inline">Agenda</span>
          <ExternalLink size={12} className="hidden sm:inline" />
        </Button>
      </a>
    );
  }

  function create() {
    setError(null);
    startTransition(async () => {
      try {
        const { url } = await createAgendaDoc(id);
        router.refresh();
        if (url) window.open(url, "_blank", "noreferrer");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't create the agenda. Try again.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        onClick={create}
        disabled={isPending}
        title="Create agenda"
        aria-label="Create agenda"
        className="w-11 px-0 sm:w-auto sm:px-5"
      >
        <FileText size={16} />
        <span className="hidden sm:inline">
          {isPending ? "Creating..." : "Agenda"}
        </span>
      </Button>
      {error ? (
        <p className="max-w-xs text-right text-xs text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
