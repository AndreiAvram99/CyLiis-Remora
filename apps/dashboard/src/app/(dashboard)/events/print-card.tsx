"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Hash } from "lucide-react";
import {
  PRINT_STATUS_EMOJI,
  PRINT_STATUS_LABELS,
  sortPrintFiles,
  type PrintStatus,
} from "@repo/shared";
import { Badge, Card } from "@/components/ui";
import { DeleteEventButton } from "./delete-button";
import { PrintControls } from "./print-controls";

export interface PrintCardFile {
  id: string;
  name: string;
  order: number;
  copies: number;
  filamentType: string;
  infill: number;
  wallCount: number;
  color: string;
  needsSupport: boolean;
}

export function PrintCard({
  id,
  title,
  status,
  channelName,
  claimedByName,
  discordHref,
  isManager,
  canDelete,
  files,
}: {
  id: string;
  title: string;
  status: string;
  channelName: string;
  claimedByName: string | null;
  discordHref: string | null;
  isManager: boolean;
  canDelete: boolean;
  files: PrintCardFile[];
}) {
  const done = status === "DONE";
  const pending = status === "PENDING";
  const printing = status === "PRINTING";
  // Done jobs start collapsed so the pending ones stand out.
  const [open, setOpen] = useState(!done);
  const ordered = sortPrintFiles(files);

  const liveTone = printing ? "bg-palette-azure" : "bg-palette-sun";

  return (
    <Card
      className={`space-y-3 transition-shadow ${
        pending
          ? "ring-1 ring-palette-sun/40 shadow-[0_0_20px_-6px_rgba(224,188,99,0.45)]"
          : printing
            ? "ring-1 ring-palette-azure/40"
            : done
              ? "border-emerald-500/50 ring-1 ring-emerald-500/30 shadow-[0_0_18px_-8px_rgba(16,185,129,0.5)]"
              : ""
      } ${done && !open ? "opacity-90" : ""}`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-0.5 shrink-0 rounded-md p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
          aria-label={open ? "Collapse" : "Expand"}
          aria-expanded={open}
        >
          <ChevronDown
            size={16}
            className={`transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-palette-azure/10 text-palette-azure">PRINT</Badge>
            <span className="flex items-center gap-1.5">
              {pending || printing ? (
                <span className="relative flex h-2.5 w-2.5" aria-hidden>
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${liveTone}`}
                  />
                  <span
                    className={`relative inline-flex h-2.5 w-2.5 rounded-full ${liveTone}`}
                  />
                </span>
              ) : (
                <span>{PRINT_STATUS_EMOJI[status as PrintStatus] ?? "🕓"}</span>
              )}
              <span
                className={`text-sm ${
                  pending
                    ? "text-palette-sun"
                    : printing
                      ? "text-palette-azure"
                      : done
                        ? "font-medium text-emerald-400"
                        : "text-neutral-400"
                }`}
              >
                {PRINT_STATUS_LABELS[status as PrintStatus] ?? status}
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs text-neutral-500">
              <Hash size={12} />
              {channelName}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span
                className={`h-1.5 w-1.5 rounded-full ${claimedByName ? "bg-palette-azure" : "bg-neutral-600"}`}
              />
              {claimedByName ? `Claimed by ${claimedByName}` : "Unclaimed"}
            </span>
          </div>

          {open ? (
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-300">
              {ordered.map((f) => (
                <li key={f.id} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/20"
                      style={{ backgroundColor: f.color }}
                      title={f.color}
                    />
                    <span className="min-w-0 truncate">{f.name}</span>
                    <span className="shrink-0 text-xs font-medium text-neutral-400">
                      ×{f.copies}
                    </span>
                  </div>
                  <div className="pl-5 text-xs text-neutral-500">
                    {f.filamentType} · {f.infill}% infill · {f.wallCount} walls
                    {f.needsSupport ? " · needs support" : ""}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            // Collapsed summary: color dots + file names on one line.
            <div className="mt-1.5 flex items-center gap-2 text-sm text-neutral-400">
              <span className="flex shrink-0 items-center gap-1">
                {ordered.map((f) => (
                  <span
                    key={f.id}
                    className="h-3 w-3 rounded-full border border-black/20"
                    style={{ backgroundColor: f.color }}
                    title={f.name}
                  />
                ))}
              </span>
              <span className="min-w-0 truncate">
                {ordered.map((f) => f.name).join(", ")}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {discordHref ? (
            <a
              href={discordHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-neutral-400 transition hover:text-neutral-100"
            >
              <ExternalLink size={12} /> Open
            </a>
          ) : null}
          {canDelete ? <DeleteEventButton id={id} title={title} /> : null}
        </div>
      </div>

      {open && isManager ? (
        <div className="border-t border-[rgb(var(--line))] pt-3">
          <PrintControls id={id} status={status} files={files} />
        </div>
      ) : null}
    </Card>
  );
}
