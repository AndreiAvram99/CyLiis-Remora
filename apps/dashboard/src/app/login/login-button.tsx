"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";

export function LoginButton() {
  return (
    <button
      onClick={() => signIn("discord", { callbackUrl: "/events" })}
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-[14px] bg-brand font-medium text-brand-fg shadow-soft transition hover:brightness-110"
    >
      <Image
        src="/discord-mark.png"
        alt=""
        width={24}
        height={18}
        aria-hidden
        className="h-[18px] w-auto"
      />
      Continue with Discord
    </button>
  );
}
