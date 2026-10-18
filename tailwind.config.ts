import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "PingFang SC",
          "HarmonyOS Sans SC",
          "Microsoft YaHei",
          "Noto Sans CJK SC",
          "sans-serif",
        ],
      },
      screens: {
        xs: "420px",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
      },
      boxShadow: {
        // Argon 高定：漫反射环境光阴影（多层、低不透明度、带一缕品牌蓝）
        card:
          "0 2px 10px -3px rgba(6,81,237,0.04), 0 10px 25px -5px rgba(15,23,42,0.03)",
        "card-hover":
          "0 4px 14px -3px rgba(6,81,237,0.10), 0 18px 36px -8px rgba(15,23,42,0.10)",
        sm: "0 1px 2px rgba(15,23,42,0.05)",
        DEFAULT:
          "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
        md: "0 4px 12px -2px rgba(15,23,42,0.08), 0 2px 6px -1px rgba(15,23,42,0.04)",
        lg: "0 12px 28px -6px rgba(15,23,42,0.12), 0 4px 10px -4px rgba(15,23,42,0.05)",
        xl: "0 20px 44px -10px rgba(15,23,42,0.16), 0 8px 16px -8px rgba(15,23,42,0.06)",
        "2xl":
          "0 28px 60px -12px rgba(15,23,42,0.22), 0 12px 24px -12px rgba(15,23,42,0.08)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        shimmer: "shimmer 2.4s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
