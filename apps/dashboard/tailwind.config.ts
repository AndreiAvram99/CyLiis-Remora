import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#5865F2",
          fg: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};

export default config;
