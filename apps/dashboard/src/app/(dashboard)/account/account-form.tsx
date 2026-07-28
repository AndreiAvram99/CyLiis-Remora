"use client";

import { useRef, useState } from "react";
import { Upload, Trash2, Check, Sun, Moon, Monitor } from "lucide-react";
import { Card } from "@/components/ui";
import {
  usePersonalization,
  Avatar,
  PALETTE_SWATCHES,
  DEFAULT_ACCENT,
  type ThemePreference,
} from "@/components/personalization";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Downscale an uploaded image to a small square data URL to keep storage light. */
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function AccountForm({
  name,
  discordAvatar,
}: {
  name?: string | null;
  discordAvatar?: string | null;
}) {
  const { accent, setAccent, avatar, setAvatar, theme, setTheme } =
    usePersonalization();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      setAvatar(await fileToAvatar(file));
    } catch {
      /* ignore bad file */
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Appearance</h2>
          <p className="text-sm text-neutral-400">
            Choose a light or dark look, or follow your device setting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                aria-pressed={selected}
                className={
                  selected
                    ? "inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition"
                    : "inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-200 transition hover:bg-neutral-700"
                }
              >
                <Icon size={15} /> {label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Your picture</h2>
          <p className="text-sm text-neutral-400">
            Shown next to your name in the header.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Avatar name={name} size={72} src={discordAvatar} />
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 transition hover:bg-neutral-700 disabled:opacity-50"
            >
              <Upload size={14} /> {busy ? "Loading…" : "Upload image"}
            </button>
            {avatar ? (
              <button
                onClick={() => setAvatar(null)}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-neutral-400 transition hover:text-red-400"
              >
                <Trash2 size={14} /> Remove
              </button>
            ) : discordAvatar ? (
              <span className="text-xs text-neutral-500">
                Using your Discord avatar.
              </span>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Avatar color</h2>
          <p className="text-sm text-neutral-400">
            Colors your avatar icon in the header. It doesn&apos;t change buttons
            or anything else.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PALETTE_SWATCHES.map((hex) => {
            const selected = accent.toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                onClick={() => setAccent(hex)}
                className="flex h-10 w-10 items-center justify-center rounded-full transition"
                style={{
                  backgroundColor: hex,
                  boxShadow: selected
                    ? `0 0 0 2px rgb(var(--n-900)), 0 0 0 4px ${hex}`
                    : "none",
                }}
                title={hex}
                aria-label={`Accent ${hex}`}
              >
                {selected ? (
                  <Check size={16} className="text-white drop-shadow" />
                ) : null}
              </button>
            );
          })}
          <label
            className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-neutral-700 bg-neutral-800 px-4 text-sm text-neutral-200"
            title="Custom color"
          >
            <span
              className="h-4 w-4 rounded-full border border-neutral-600"
              style={{ backgroundColor: accent }}
            />
            Custom
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-0 w-0 opacity-0"
            />
          </label>
        </div>
        <button
          onClick={() => setAccent(DEFAULT_ACCENT)}
          className="text-xs text-neutral-500 transition hover:text-neutral-300"
        >
          Reset to default
        </button>
      </Card>

      <p className="text-xs text-neutral-500">
        These preferences are saved in this browser only.
      </p>
    </div>
  );
}
