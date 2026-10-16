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
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 10px)",
      },
      boxShadow: {
        sm: "0 1px 2px hsl(var(--shadow-tint) / 0.05), 0 1px 3px hsl(var(--shadow-tint) / 0.07)",
        DEFAULT:
          "0 1px 2px hsl(var(--shadow-tint) / 0.05), 0 2px 6px -1px hsl(var(--shadow-tint) / 0.08)",
        md: "0 2px 4px hsl(var(--shadow-tint) / 0.05), 0 6px 16px -4px hsl(var(--shadow-tint) / 0.09)",
        lg: "0 4px 8px hsl(var(--shadow-tint) / 0.06), 0 12px 32px -8px hsl(var(--shadow-tint) / 0.14)",
        xl: "0 8px 16px hsl(var(--shadow-tint) / 0.08), 0 24px 48px -12px hsl(var(--shadow-tint) / 0.22)",
        "2xl":
          "0 12px 24px hsl(var(--shadow-tint) / 0.1), 0 32px 64px -16px hsl(var(--shadow-tint) / 0.28)",
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
