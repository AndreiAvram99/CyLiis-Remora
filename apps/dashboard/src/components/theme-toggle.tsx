"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { usePersonalization } from "@/components/personalization";

/** Quick light/dark switch for the header. Mirrors the current effective theme. */
export function ThemeToggle() {
  const { theme, setTheme } = usePersonalization();
  const [isDark, setIsDark] = useState(true);

  // Reflect the actual applied theme (handles the "system" preference too).
  useEffect(() => {
    const update = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    update();
  }, [theme]);

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center justify-center rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
