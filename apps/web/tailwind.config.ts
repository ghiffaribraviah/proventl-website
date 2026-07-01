import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      backgroundImage: {
        "proventl-radial":
          "radial-gradient(circle at 0% 0%, rgba(38, 60, 146, 0.08) 0%, transparent 50%), radial-gradient(circle at 100% 0%, rgba(254, 216, 11, 0.10) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(38, 60, 146, 0.05) 0%, transparent 50%), radial-gradient(circle at 0% 100%, rgba(254, 216, 11, 0.05) 0%, transparent 50%)",
      },
      colors: {
        "ipb-blue": "#263c92",
        "ipb-blue-dark": "#1c2d6e",
        "ipb-blue-soft": "rgba(38, 60, 146, 0.08)",
        "ipb-yellow": "#fed80b",
        success: "#22c55e",
        danger: "#ef4444",
        fg: "#1e293b",
        muted: "#64748b",
      },
      fontFamily: {
        display: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'SF Pro Display'",
          "system-ui",
          "sans-serif",
        ],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'SF Pro Text'",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "'JetBrains Mono'",
          "'IBM Plex Mono'",
          "ui-monospace",
          "Menlo",
          "monospace",
        ],
      },
      keyframes: {
        popIn: {
          from: { transform: "scale(0.85)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "batch-pop-in": "popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "batch-slide-up": "slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "batch-spin": "spin 1s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
