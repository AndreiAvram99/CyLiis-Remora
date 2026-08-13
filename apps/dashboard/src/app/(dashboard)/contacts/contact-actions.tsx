"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { deleteContact } from "./actions";

export function DeleteContact({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Delete this contact?")) return;
    startTransition(async () => {
      await deleteContact(id);
      router.refresh();
    });
  }

  return (
    <Button
      variant="danger"
      onClick={handleDelete}
      disabled={isPending}
      className="w-11 px-0"
      title={isPending ? "Deleting..." : "Delete"}
      aria-label="Delete"
    >
      <Trash2 className="h-5 w-5" />
    </Button>
  );
}
