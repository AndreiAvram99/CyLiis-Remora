"use client";

import { useState } from "react";

/**
 * Instagram serves profile pictures from signed urls that expire, so the stored
 * one eventually 404s. Fall back to initials rather than a broken image.
 */
export function SenderAvatar({
  src,
  handle,
}: {
  src: string | null;
  handle: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = src && !broken;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setBroken(true)}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-[11px] font-semibold text-neutral-300">
      {handle.replace(/^@/, "").slice(0, 2).toUpperCase() || "IG"}
    </span>
  );
}
