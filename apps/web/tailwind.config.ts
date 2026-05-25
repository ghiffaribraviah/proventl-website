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
        "ipb-yellow": "#fed80b",
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
      },
    },
  },
  plugins: [],
} satisfies Config;
