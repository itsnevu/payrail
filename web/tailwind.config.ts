import type { Config } from "tailwindcss";

/**
 * Payrail palette: black and gray. Written as hex literals (not var()) so Tailwind 3
 * opacity modifiers (`bg-bg/85`, `border-line/60`) keep working. The same values are declared
 * again as custom properties in globals.css for the landing CSS (.lp / .ip).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./content/**/*.md"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0a",
        surface: "#161616",
        field: "#1c1c1c",
        line: "#2c2c2c",
        ink: "#f2f2f2",
        "ink-soft": "#a8a8a8",
        "ink-faint": "#6e6e6e",
        green: "#e6e6e6",
        "green-accent": "#ffffff",
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
