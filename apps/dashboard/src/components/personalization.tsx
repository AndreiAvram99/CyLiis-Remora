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

export const DEFAULT_ACCENT = "#8ecae6";

export const PALETTE_SWATCHES = [
  "#8ecae6",
  "#209ebb",
  "#023047",
  "#ffb701",
  "#fc8500",
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

function applyAccent(hex: string) {
  const root = document.documentElement;
  root.style.setProperty("--brand", hex);
  root.style.setProperty("--brand-fg", readableFg(hex));
}

interface PersonalizationValue {
  accent: string;
  avatar: string | null;
  setAccent: (hex: string) => void;
  setAvatar: (dataUrl: string | null) => void;
}

const PersonalizationContext = createContext<PersonalizationValue | null>(null);

export function PersonalizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [accent, setAccentState] = useState(DEFAULT_ACCENT);
  const [avatar, setAvatarState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedAccent = localStorage.getItem(ACCENT_KEY);
      const savedAvatar = localStorage.getItem(AVATAR_KEY);
      if (savedAccent) {
        setAccentState(savedAccent);
        applyAccent(savedAccent);
      }
      if (savedAvatar) setAvatarState(savedAvatar);
    } catch {
      // localStorage unavailable — fall back to defaults.
    }
  }, []);

  const setAccent = useCallback((hex: string) => {
    setAccentState(hex);
    applyAccent(hex);
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

  return (
    <PersonalizationContext.Provider
      value={{ accent, avatar, setAccent, setAvatar }}
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

/** The user's avatar image, or their initials on the accent color as fallback. */
export function Avatar({
  name,
  size = 32,
}: {
  name?: string | null;
  size?: number;
}) {
  const { avatar } = usePersonalization();
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
      className="flex items-center justify-center rounded-full bg-brand font-semibold text-brand-fg ring-1 ring-neutral-700"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}
