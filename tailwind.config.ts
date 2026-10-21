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
          "Smartisan Compact",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "PingFang SC",
          "Noto Sans CJK SC",
          "Source Han Sans SC",
          "HarmonyOS Sans SC",
          "Microsoft YaHei",
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
        title: {
          other: "hsl(var(--s-title-other))",
        },
        sicon: {
          DEFAULT: "hsl(var(--s-icon))",
          chevron: "hsl(var(--s-chevron))",
        },
      },
      boxShadow: {
        // Smartisan：投影透明度基本 ≤ 0.1，极淡大范围
        card: "0 10px 16px rgba(0,0,0,0.04)",
        "card-hover": "0 12px 20px rgba(0,0,0,0.08)",
        sm: "0 1px 2px rgba(0,0,0,0.05)",
        DEFAULT: "0 1px 2px rgba(0,0,0,0.05)",
        md: "0 2px 6px rgba(0,0,0,0.06)",
        lg: "0 6px 12px rgba(0,0,0,0.07)",
        xl: "0 8px 16px rgba(0,0,0,0.08)",
        "2xl": "0 10px 16px rgba(0,0,0,0.10)",
        // Smartisan 组件投影
        "s-btn": "0 4px 2px rgba(0,0,0,0.10)",
        "s-knob": "0 5px 16.6px rgba(0,0,0,0.21)",
        "s-thumb": "0 4px 4px rgba(0,0,0,0.08)",
        "s-bar": "0 4px 4px rgba(0,0,0,0.08)",
        // 内凹（开关轨道 / 输入框 / Tab 选中 / 滑块轨道）
        "inset-track": "inset 0 4px 4px rgba(0,0,0,0.06)",
        "inset-switch": "inset 0 4px 12px rgba(0,0,0,0.10)",
        "inset-field": "inset 0 4px 4px rgba(0,0,0,0.04)",
        "inset-tab": "inset 0 4px 10px rgba(0,0,0,0.06)",
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
