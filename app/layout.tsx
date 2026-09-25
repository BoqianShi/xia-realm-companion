import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "侠界之旅 · 行侠手记",
  description: "浏览武学、试配角色、核对伤害，与同伴共记一段江湖。",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
