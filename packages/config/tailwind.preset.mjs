/** Shared Tailwind preset — apps/web pulls this in via `presets: [require("@pcc/config/tailwind")]`. */

/** `oklch(var(--x) / <alpha-value>)` lets Tailwind's `/NN` opacity modifiers work against an L-C-H triplet stored in the CSS var (mirrors the classic shadcn `hsl(var(--x) / <alpha-value>)` convention). */
function oklchVar(name) {
  return `oklch(var(${name}) / <alpha-value>)`;
}

/** @type {import('tailwindcss').Config} */
const preset = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        border: oklchVar("--border"),
        input: oklchVar("--input"),
        ring: oklchVar("--ring"),
        background: oklchVar("--background"),
        foreground: oklchVar("--foreground"),
        primary: {
          DEFAULT: oklchVar("--primary"),
          foreground: oklchVar("--primary-foreground"),
        },
        secondary: {
          DEFAULT: oklchVar("--secondary"),
          foreground: oklchVar("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: oklchVar("--destructive"),
          foreground: oklchVar("--background"),
        },
        muted: {
          DEFAULT: oklchVar("--muted"),
          foreground: oklchVar("--muted-foreground"),
        },
        accent: {
          DEFAULT: oklchVar("--accent"),
          foreground: oklchVar("--accent-foreground"),
        },
        popover: {
          DEFAULT: oklchVar("--popover"),
          foreground: oklchVar("--popover-foreground"),
        },
        card: {
          DEFAULT: oklchVar("--card"),
          foreground: oklchVar("--card-foreground"),
        },
        sidebar: {
          DEFAULT: oklchVar("--sidebar"),
          foreground: oklchVar("--sidebar-foreground"),
          primary: oklchVar("--sidebar-primary"),
          "primary-foreground": oklchVar("--sidebar-primary-foreground"),
          accent: oklchVar("--sidebar-accent"),
          "accent-foreground": oklchVar("--sidebar-accent-foreground"),
          border: oklchVar("--sidebar-border"),
          ring: oklchVar("--sidebar-ring"),
        },
        chart: {
          1: oklchVar("--chart-1"),
          2: oklchVar("--chart-2"),
          3: oklchVar("--chart-3"),
          4: oklchVar("--chart-4"),
          5: oklchVar("--chart-5"),
        },
        status: {
          up: oklchVar("--status-up"),
          down: oklchVar("--status-down"),
          sleeping: oklchVar("--status-sleeping"),
          unknown: oklchVar("--status-unknown"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      keyframes: {
        "signal-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "signal-pulse": "signal-pulse 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default preset;
