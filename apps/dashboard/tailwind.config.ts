import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        // Soft, premium elevation — never harsh.
        soft: "0 8px 24px rgba(0,0,0,0.25)",
        card: "0 12px 32px rgba(0,0,0,0.35)",
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
      colors: {
        // Accent is driven by a CSS variable so each user can pick their own.
        brand: {
          DEFAULT: "var(--brand)",
          fg: "var(--brand-fg)",
        },
        // Palette + neutral scale are driven by CSS variables (RGB channels) so
        // the whole UI can flip between light and dark themes without touching
        // component classes. The `<alpha-value>` placeholder keeps `/opacity`
        // modifiers (e.g. bg-palette-sky/20) working.
        palette: {
          sky: "rgb(var(--pal-sky) / <alpha-value>)",
          azure: "rgb(var(--pal-azure) / <alpha-value>)",
          navy: "rgb(var(--pal-navy) / <alpha-value>)",
          sun: "rgb(var(--pal-sun) / <alpha-value>)",
          flame: "rgb(var(--pal-flame) / <alpha-value>)",
        },
        neutral: {
          50: "rgb(var(--n-50) / <alpha-value>)",
          100: "rgb(var(--n-100) / <alpha-value>)",
          200: "rgb(var(--n-200) / <alpha-value>)",
          300: "rgb(var(--n-300) / <alpha-value>)",
          400: "rgb(var(--n-400) / <alpha-value>)",
          500: "rgb(var(--n-500) / <alpha-value>)",
          600: "rgb(var(--n-600) / <alpha-value>)",
          700: "rgb(var(--n-700) / <alpha-value>)",
          800: "rgb(var(--n-800) / <alpha-value>)",
          900: "rgb(var(--n-900) / <alpha-value>)",
          950: "rgb(var(--n-950) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
