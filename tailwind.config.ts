import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* shadcn-compatible tokens */
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* LP design tokens — direct hex */
        "lp-bg":       "#0B0B0C",
        "lp-bg2":      "#111113",
        "lp-bg3":      "#17171A",
        "lp-bg4":      "#1D1D21",
        "lp-border":   "#232328",
        "lp-border2":  "#2E2E35",
        "lp-subtle":   "#3A3A44",
        "lp-text":     "#E8E8EC",
        "lp-muted":    "#6B6B78",
        "lp-muted2":   "#8A8A95",
        "lp-purple":   "#7C6FF7",
        "lp-purple-l": "#A99DF9",
        "lp-teal":     "#2DD4A0",
        "lp-amber":    "#F0A429",
        "lp-red":      "#F06060",
      },
      borderRadius: {
        lg:   "var(--radius)",
        md:   "calc(var(--radius) - 2px)",
        sm:   "calc(var(--radius) - 4px)",
        card: "10px",
        btn:  "7px",
        logo: "7px",
      },
      fontFamily: {
        sans:  ["var(--font-sans)"],
        mono:  ["var(--font-mono)"],
        serif: ["var(--font-serif)"],
      },
    },
  },
  plugins: [],
};

export default config;
