"use client";

import { SessionProvider } from "next-auth/react";
import { PersonalizationProvider } from "./personalization";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PersonalizationProvider>{children}</PersonalizationProvider>
    </SessionProvider>
  );
}
