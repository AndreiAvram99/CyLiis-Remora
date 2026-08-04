import { FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui";

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
