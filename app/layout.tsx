import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GlucoFit 代谢自动驾驶 · Metabolic Autopilot v3.0",
  description:
    "面向胰岛素抵抗与超重人群的代谢数字孪生系统：虚拟血糖/胰岛素潮汐推演、吃前排雷、水合解耦降噪与周期双模断食引擎",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans">{children}</body>
    </html>
  );
}
