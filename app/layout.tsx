import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GlucoFit 控糖与代谢改善系统",
  description:
    "面向胰岛素抵抗与超重人群的代谢管理系统：体脂秤体成分精细追踪 + 控糖饮食行为打卡",
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
