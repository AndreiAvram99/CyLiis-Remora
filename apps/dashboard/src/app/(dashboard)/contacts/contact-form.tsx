"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CONTACT_KINDS,
  CONTACT_KIND_LABELS,
  type ContactKind,
} from "@repo/shared";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import type { ContactValues } from "@/lib/validation";
import { createContact, updateContact } from "./actions";

const EMPTY: ContactValues = {
  kind: "SPONSOR",
  name: "",
  person: null,
  role: null,
  email: null,
  phone: null,
  instagram: null,
  linkedin: null,
  website: null,
  notes: null,
};

/**
 * Only the name is asked for. The rest is however this particular contact
 * happens to be reachable — some answer on Instagram, some only by phone.
 */
export function ContactForm({
  id,
  initial,
}: {
  id?: string;
  initial?: ContactValues;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<ContactValues>(initial ?? EMPTY);

  function patch(next: Partial<ContactValues>) {
    setValues((v) => ({ ...v, ...next }));
  }

  function text(field: keyof ContactValues): string {
    const value = values[field];
    return typeof value === "string" ? value : "";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.name.trim()) {
      setError("A name is required.");
      return;
    }
    startTransition(async () => {
      try {
        if (id) await updateContact(id, values);
        else await createContact(values);
        router.push("/contacts");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save that.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="space-y-5 p-6">
        <div>
          <Label>Kind</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {CONTACT_KINDS.map((kind) => {
              const on = values.kind === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => patch({ kind: kind as ContactKind })}
                  aria-pressed={on}
                  className={`rounded-[14px] border px-4 py-3 text-left text-sm transition ${
                    on
                      ? "border-brand bg-brand/10 text-neutral-100"
                      : "border-[rgb(var(--line))] text-neutral-300 hover:border-neutral-600"
                  }`}
                >
                  <span className="font-medium">
                    {CONTACT_KIND_LABELS[kind]}
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {kind === "SPONSOR"
                      ? "Someone who backs us"
                      : "Someone we ran an event with"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Company or organisation"
              required
            />
          </div>
          <div>
            <Label htmlFor="person">Contact person</Label>
            <Input
              id="person"
              value={text("person")}
              onChange={(e) => patch({ person: e.target.value })}
              placeholder="Who we talk to"
            />
          </div>
          <div>
            <Label htmlFor="role">Their role</Label>
            <Input
              id="role"
              value={text("role")}
              onChange={(e) => patch({ role: e.target.value })}
              placeholder="Marketing lead"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={text("phone")}
              onChange={(e) => patch({ phone: e.target.value })}
              placeholder="+40 7xx xxx xxx"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={text("email")}
              onChange={(e) => patch({ email: e.target.value })}
              placeholder="name@company.com"
            />
          </div>
          <div>
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              value={text("instagram")}
              onChange={(e) => patch({ instagram: e.target.value })}
              placeholder="@handle"
            />
          </div>
          <div>
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input
              id="linkedin"
              value={text("linkedin")}
              onChange={(e) => patch({ linkedin: e.target.value })}
              placeholder="linkedin.com/company/..."
            />
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={text("website")}
              onChange={(e) => patch({ website: e.target.value })}
              placeholder="company.com"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            rows={4}
            value={text("notes")}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="What we agreed, what they gave us, who introduced us."
          />
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="success" disabled={isPending}>
            {isPending ? "Saving..." : id ? "Save contact" : "Add contact"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/contacts")}
          >
            Cancel
          </Button>
        </div>
      </Card>
    </form>
  );
}
