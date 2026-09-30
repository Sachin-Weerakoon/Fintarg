import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        muted: "rgb(var(--c-surface-muted) / <alpha-value>)",
        border: "rgb(var(--c-border) / <alpha-value>)",
        text: "rgb(var(--c-text) / <alpha-value>)",
        "text-muted": "rgb(var(--c-text-muted) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        "accent-contrast": "rgb(var(--c-accent-contrast) / <alpha-value>)",
        "accent-soft": "rgb(var(--c-accent-soft) / <alpha-value>)",
        positive: "rgb(var(--c-positive) / <alpha-value>)",
        positiveSoft: "rgb(var(--c-positive-soft) / <alpha-value>)",
        warning: "rgb(var(--c-warning) / <alpha-value>)",
        warningSoft: "rgb(var(--c-warning-soft) / <alpha-value>)",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
        dangerSoft: "rgb(var(--c-danger-soft) / <alpha-value>)",
        info: "rgb(var(--c-info) / <alpha-value>)",
        infoSoft: "rgb(var(--c-info-soft) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "'Noto Sans Sinhala'",
          "'Noto Sans Tamil'",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      fontSize: {
        display: ["var(--fs-display)", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        h1: ["var(--fs-h1)", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        h2: ["var(--fs-h2)", { lineHeight: "1.35" }],
        body: ["var(--fs-body)", { lineHeight: "1.55" }],
        small: ["var(--fs-small)", { lineHeight: "1.5" }],
        caption: ["var(--fs-caption)", { lineHeight: "1.45" }],
      },
      borderRadius: {
        card: "12px",
        input: "8px",
        pill: "9999px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(20, 40, 75, 0.08)",
        raised: "0 4px 16px rgba(20, 40, 75, 0.12)",
        focus: "0 0 0 3px rgb(var(--c-focus-ring) / 0.45)",
      },
      spacing: {
        card: "var(--space-card)",
        row: "var(--space-row)",
        section: "var(--space-section)",
        "content-x": "var(--space-content-x)",
      },
      minHeight: {
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      },
      height: {
        touch: "44px",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out both",
        "slide-up": "slide-up 220ms ease-out both",
        "slide-down": "slide-down 180ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
