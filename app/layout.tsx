import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./smartisan.css";

export const metadata: Metadata = {
  title: "GlucoFit 代谢自动驾驶 · Metabolic Autopilot v3.0",
  description:
    "面向胰岛素抵抗与超重人群的代谢数字孪生系统：虚拟血糖/胰岛素潮汐推演、吃前排雷、水合解耦降噪与周期双模断食引擎",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f5" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};

/** 水合前同步主题类，避免明暗闪烁（FOUC） */
const themeInitScript = `(function(){try{var t=localStorage.getItem("glucofit-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="s-page min-h-dvh font-sans">{children}</body>
      <Script src="/smartisan.js" strategy="afterInteractive" />
    </html>
  );
}
