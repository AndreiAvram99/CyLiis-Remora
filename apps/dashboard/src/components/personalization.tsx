"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const ACCENT_KEY = "remora:accent";
const AVATAR_KEY = "remora:avatar";
const THEME_KEY = "remora:theme";

export const DEFAULT_ACCENT = "#209edb";

export type ThemePreference = "light" | "dark" | "system";
export const DEFAULT_THEME: ThemePreference = "dark";

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Toggle the `.dark` class on <html> based on the chosen preference. */
function applyTheme(theme: ThemePreference) {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export const PALETTE_SWATCHES = [
  "#209edb",
  "#8acae8",
  "#203047",
  "#ffe201",
  "#fca50c",
];

/** Pick a legible foreground for a given accent using perceived luminance. */
export function readableFg(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#023047" : "#ffffff";
}

interface PersonalizationValue {
  accent: string;
  avatar: string | null;
  theme: ThemePreference;
  setAccent: (hex: string) => void;
  setAvatar: (dataUrl: string | null) => void;
  setTheme: (theme: ThemePreference) => void;
}

const PersonalizationContext = createContext<PersonalizationValue | null>(null);

export function PersonalizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [accent, setAccentState] = useState(DEFAULT_ACCENT);
  const [avatar, setAvatarState] = useState<string | null>(null);
  const [theme, setThemeState] = useState<ThemePreference>(DEFAULT_THEME);

  useEffect(() => {
    try {
      const savedAccent = localStorage.getItem(ACCENT_KEY);
      const savedAvatar = localStorage.getItem(AVATAR_KEY);
      const savedTheme = localStorage.getItem(THEME_KEY) as ThemePreference | null;
      if (savedAccent) setAccentState(savedAccent);
      if (savedAvatar) setAvatarState(savedAvatar);
      if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
        setThemeState(savedTheme);
      }
    } catch {
      // localStorage unavailable — fall back to defaults.
    }
  }, []);

  // Keep "system" preference in sync with OS-level changes while selected.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setAccent = useCallback((hex: string) => {
    setAccentState(hex);
    try {
      localStorage.setItem(ACCENT_KEY, hex);
    } catch {
      /* ignore */
    }
  }, []);

  const setAvatar = useCallback((dataUrl: string | null) => {
    setAvatarState(dataUrl);
    try {
      if (dataUrl) localStorage.setItem(AVATAR_KEY, dataUrl);
      else localStorage.removeItem(AVATAR_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <PersonalizationContext.Provider
      value={{ accent, avatar, theme, setAccent, setAvatar, setTheme }}
    >
      {children}
    </PersonalizationContext.Provider>
  );
}

export function usePersonalization(): PersonalizationValue {
  const ctx = useContext(PersonalizationContext);
  if (!ctx) {
    throw new Error(
      "usePersonalization must be used within a PersonalizationProvider",
    );
  }
  return ctx;
}

function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * The user's avatar image, or their initials on their chosen accent color.
 * The accent only ever affects this icon — buttons and highlights stay on the
 * app's primary blue.
 */
export function Avatar({
  name,
  size = 32,
}: {
  name?: string | null;
  size?: number;
}) {
  const { avatar, accent } = usePersonalization();
  if (avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatar}
        alt={name ?? "avatar"}
        width={size}
        height={size}
        className="rounded-full object-cover ring-1 ring-neutral-700"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-full font-semibold ring-1 ring-neutral-700"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        backgroundColor: accent,
        color: readableFg(accent),
      }}
    >
      {initials(name)}
    </span>
  );
}
