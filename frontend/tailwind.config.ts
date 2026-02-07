import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "sm-bg": "#1a1a2e",
        "sm-surface": "#1e293b",
        "sm-surface-hover": "#2d3a4f",
        "sm-text": "#e2e8f0",
        "sm-text-dim": "#94a3b8",
        "sm-ok": "#22c55e",
        "sm-warn": "#f59e0b",
        "sm-error": "#ef4444",
        "sm-link": "#3b82f6",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
