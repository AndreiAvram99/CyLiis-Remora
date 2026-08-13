"use client";

import { useState } from "react";

const SIZES = {
  sm: "h-6 w-6",
  md: "h-7 w-7",
} as const;

/**
 * A Discord avatar url names the picture's own hash, so it stops resolving the
 * moment someone changes their photo. The roster catches up within minutes;
 * until it does, show initials rather than a broken image.
 */
export function MemberAvatar({
  name,
  src,
  size = "sm",
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
}) {
  const [broken, setBroken] = useState(false);
  const box = SIZES[size];

  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        onError={() => setBroken(true)}
        className={`${box} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      className={`${box} flex shrink-0 items-center justify-center rounded-full bg-neutral-800 text-[10px] font-semibold text-neutral-300`}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
