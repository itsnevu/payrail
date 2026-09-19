import type { Config } from "tailwindcss";

/**
 * Payrail palette: white page, black ink. Written as hex literals (not var()) so Tailwind 3
 * opacity modifiers (`bg-bg/85`, `border-line/60`) keep working. The same values are declared
 * again as custom properties in globals.css for the landing CSS (.lp / .ip).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./content/**/*.md"],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        surface: "#f6f6f8",
        field: "#eeeef1",
        line: "#e2e2e7",
        ink: "#0a0a0a",
        "ink-soft": "#5f606a",
        "ink-faint": "#9a9ba5",
        green: "#0a0a0a",
        "green-accent": "#2a2a2a",
        bezel: "#050505",
        lens: "#1a1a1a",
      },
      fontFamily: {
        sans: ["var(--font-grotesk)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
