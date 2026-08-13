"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { Button, Label } from "@/components/ui";

/**
 * A logo is chosen as a file rather than typed as an address, and SVG only:
 * these are drawn once and then shown at half a dozen sizes, which a bitmap
 * can't survive. The picture on show is the one that will be saved, so a file
 * meant for the other background is obvious before saving.
 */
export function LogoField({
  field,
  label,
  hint,
  currentUrl,
  onDark,
}: {
  field: "logo" | "logoLight";
  label: string;
  hint: string;
  currentUrl: string | null;
  /** Which background this version is drawn for, so the preview matches it. */
  onDark: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ name: string; url: string } | null>(
    null,
  );
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    return () => {
      if (picked) URL.revokeObjectURL(picked.url);
    };
  }, [picked]);

  const shown = picked?.url ?? (cleared ? null : currentUrl);

  function choose(file: File | undefined) {
    if (picked) URL.revokeObjectURL(picked.url);
    setPicked(
      file ? { name: file.name, url: URL.createObjectURL(file) } : null,
    );
    setCleared(false);
  }

  function clear() {
    if (picked) URL.revokeObjectURL(picked.url);
    setPicked(null);
    setCleared(true);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <Label htmlFor={field}>{label}</Label>
      <div className="space-y-3 rounded-[14px] border border-[rgb(var(--line))] p-4">
        <div
          className={`flex h-20 items-center justify-center rounded-xl ${
            onDark ? "bg-[#0a1020]" : "bg-white"
          }`}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt=""
              className="max-h-14 max-w-[70%] object-contain"
            />
          ) : (
            <span className="text-xs text-neutral-500">Nothing yet</span>
          )}
        </div>

        <input
          ref={input}
          id={field}
          name={field}
          type="file"
          accept=".svg,image/svg+xml"
          onChange={(e) => choose(e.target.files?.[0])}
          className="hidden"
        />
        {cleared ? (
          <input type="hidden" name={`${field}-clear`} value="1" />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => input.current?.click()}
            className="h-9 px-3"
          >
            <Upload size={16} />
            {shown ? "Replace" : "Choose SVG"}
          </Button>
          {shown ? (
            <Button
              type="button"
              variant="danger"
              onClick={clear}
              className="h-9 px-3"
            >
              <Trash2 size={16} />
              Remove
            </Button>
          ) : null}
          <span className="min-w-0 truncate text-xs text-neutral-500">
            {picked ? picked.name : hint}
          </span>
        </div>
      </div>
    </div>
  );
}
