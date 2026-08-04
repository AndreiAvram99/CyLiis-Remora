import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { requireManager } from "@/lib/session";
import { createAgendaDoc } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * Opens the meeting's agenda, building it first when there isn't one — or when
 * the one on record has been deleted in Drive. Going through a page rather than
 * a click handler means the browser opens the tab straight away and lands on
 * the document once Google is done.
 */
export default async function AgendaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;

  let url = "";
  let problem: string | null = null;
  try {
    ({ url } = await createAgendaDoc(id));
  } catch (err) {
    problem =
      err instanceof Error
        ? err.message
        : "Couldn't open the agenda. Try again.";
  }

  if (url) redirect(url);

  return (
    <Card className="mx-auto max-w-xl space-y-4">
      <h1 className="flex items-center gap-2 text-lg font-medium">
        <FileText size={18} className="text-palette-sun" />
        The agenda didn&apos;t open
      </h1>
      <p className="text-sm text-neutral-400">{problem}</p>
      <Link href="/events">
        <Button variant="secondary">Back to schedules</Button>
      </Link>
    </Card>
  );
}
