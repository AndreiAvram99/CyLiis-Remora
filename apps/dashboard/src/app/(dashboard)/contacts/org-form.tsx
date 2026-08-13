"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import type { OrgProfileValues } from "@/lib/validation";
import { updateOrgProfile } from "./actions";

const FIELDS: {
  key: keyof OrgProfileValues;
  label: string;
  placeholder?: string;
  wide?: boolean;
}[] = [
  { key: "name", label: "Legal name", wide: true },
  { key: "address", label: "Address", wide: true },
  { key: "fiscalCode", label: "Fiscal code", placeholder: "CUI / CIF" },
  { key: "iban", label: "IBAN" },
  { key: "bank", label: "Bank" },
  { key: "representative", label: "Representative" },
  { key: "email", label: "Contact email" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "instagram", label: "Instagram", placeholder: "@handle" },
  { key: "linkedin", label: "LinkedIn", wide: true },
];

/** The details someone else asks us for, written down once. */
export function OrgForm({ initial }: { initial: OrgProfileValues }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<OrgProfileValues>(initial);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateOrgProfile(values);
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
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                value={values[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            rows={4}
            value={values.notes ?? ""}
            onChange={(e) =>
              setValues((v) => ({ ...v, notes: e.target.value }))
            }
            placeholder="Anything else worth having at hand."
          />
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="success" disabled={isPending}>
            {isPending ? "Saving..." : "Save details"}
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
