import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Accent is driven by a CSS variable so each user can pick their own.
        brand: {
          DEFAULT: "var(--brand)",
          fg: "var(--brand-fg)",
        },
        // Source palette (Dopely "beach"): keep the raw swatches available.
        palette: {
          sky: "#8ecae6",
          azure: "#209ebb",
          navy: "#023047",
          sun: "#ffb701",
          flame: "#fc8500",
        },
        // Navy-tinted neutral scale so all existing neutral-* utilities adopt
        // the palette's deep-blue mood instead of flat grays.
        neutral: {
          50: "#f2f9fc",
          100: "#e4f1f6",
          200: "#c6e0ea",
          300: "#9fc6d6",
          400: "#6f9fb3",
          500: "#48788d",
          600: "#305d70",
          700: "#0d475e",
          800: "#072e3d",
          900: "#04222f",
          950: "#021620",
        },
      },
    },
  },
  plugins: [],
};

export default config;
