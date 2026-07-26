"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { deleteEvent } from "./actions";

export function DeleteEventButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete "${title}"? This also removes it from Google Calendar.`))
      return;
    startTransition(async () => {
      await deleteEvent(id);
      router.refresh();
    });
  }

  return (
    <Button variant="danger" onClick={handleDelete} disabled={isPending}>
      <Trash2 size={16} />
      {isPending ? "Deleting..." : "Delete"}
    </Button>
  );
}
