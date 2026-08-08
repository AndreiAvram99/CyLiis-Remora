"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, ExternalLink, FileX } from "lucide-react";
import { Button } from "@/components/ui";
import { removeAgendaDoc } from "./actions";

/**
 * Opens the meeting's agenda in a new tab. The work happens on the way there,
 * so the same button creates the document the first time, adds this occurrence's
 * tabs to a series, and rebuilds it if the document has been deleted in Drive.
 */
export function AgendaButton({
  id,
  docUrl,
}: {
  id: string;
  docUrl: string | null;
}) {
  const label = docUrl ? "Open agenda" : "Create agenda";
  return (
    <a
      href={`/events/${id}/agenda`}
      target="_blank"
      rel="noreferrer"
      title={label}
      aria-label={label}
    >
      <Button variant="secondary" className="w-11 px-0 sm:w-auto sm:px-5">
        <FileText size={16} />
        <span className="hidden sm:inline">Agenda</span>
        {docUrl ? (
          <ExternalLink size={12} className="hidden sm:inline" />
        ) : null}
      </Button>
    </a>
  );
}

/**
 * Bin the agenda document. Offered only once one exists, and only to the owner
 * — a repeating meeting keeps its whole history in that single file.
 */
export function DeleteAgendaButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (
      !confirm(
        `Delete the agenda document for "${title}"? It goes to Drive's bin, and every occurrence of this meeting loses the link.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await removeAgendaDoc(id);
      router.refresh();
    });
  }

  return (
    <Button
      variant="secondary"
      onClick={remove}
      disabled={isPending}
      title="Delete agenda"
      aria-label="Delete agenda"
      className="w-11 px-0 text-[#E56D6D] hover:text-red-400"
    >
      <FileX size={16} />
    </Button>
  );
}
