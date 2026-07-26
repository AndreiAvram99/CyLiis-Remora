"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
      title="Sign out"
    >
      <LogOut size={16} />
    </button>
  );
}
