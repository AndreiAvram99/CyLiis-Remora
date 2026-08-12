"use client";

import { useState, useTransition } from "react";
import { Check, Printer } from "lucide-react";
import {
  FILAMENT_TYPES,
  PRINT_COLORS,
  printColorMeta,
  type FilamentType,
  type PrintDefaults,
} from "@repo/shared";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { updatePrintDefaults } from "./actions";

/**
 * What a freshly dropped print file is pre-filled with. Changing these doesn't
 * touch requests already made — it only saves the next person some clicking.
 */
export function PrintDefaultsForm({ initial }: { initial: PrintDefaults }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<PrintDefaults>(initial);

  function patch(next: Partial<PrintDefaults>) {
    setValues((v) => ({ ...v, ...next }));
    setSaved(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updatePrintDefaults(values);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save that.");
      }
    });
  }

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Printer size={18} className="text-palette-sky" />
          Print defaults
        </h2>
        <p className="text-sm text-neutral-500">
          Every file added to a print request starts with these. They can still
          be changed per file.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="filament">Filament</Label>
            <Select
              id="filament"
              value={values.filamentType}
              onChange={(e) =>
                patch({ filamentType: e.target.value as FilamentType })
              }
            >
              {FILAMENT_TYPES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="infill">Infill %</Label>
            <Input
              id="infill"
              type="number"
              min={0}
              max={100}
              value={values.infill}
              onChange={(e) => patch({ infill: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="walls">Walls</Label>
            <Input
              id="walls"
              type="number"
              min={1}
              max={999}
              value={values.wallCount}
              onChange={(e) => patch({ wallCount: Number(e.target.value) })}
            />
          </div>
        </div>

        <div>
          <Label>Color</Label>
          <div className="flex flex-wrap items-center gap-2">
            {PRINT_COLORS.map((hex) => {
              const on = hex.toUpperCase() === values.color.toUpperCase();
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => patch({ color: hex })}
                  aria-pressed={on}
                  title={printColorMeta(hex).name}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                    on
                      ? "border-brand ring-2 ring-brand/40"
                      : "border-[rgb(var(--line))] hover:border-neutral-500"
                  }`}
                  style={{ backgroundColor: hex }}
                >
                  {on ? (
                    <Check
                      size={14}
                      className={
                        hex.toUpperCase() === "#FFFFFF"
                          ? "text-neutral-900"
                          : "text-white"
                      }
                    />
                  ) : null}
                </button>
              );
            })}
            <span className="text-xs text-neutral-500">
              {printColorMeta(values.color).name}
            </span>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={values.needsSupport}
            onChange={(e) => patch({ needsSupport: e.target.checked })}
            className="h-4 w-4 rounded border-neutral-700 bg-neutral-950"
          />
          Assume supports are needed
        </label>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="success" disabled={isPending}>
            {isPending ? "Saving..." : "Save defaults"}
          </Button>
          {saved ? (
            <span className="text-sm text-palette-sky">Saved.</span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
