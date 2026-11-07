import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 自動面試系統",
  description: "Recruiter 初步訪談自動化平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">
              AI 自動面試系統
            </Link>
            <nav>
              <Link href="/">總覽</Link>
              <Link href="/jobs/new">建立職缺</Link>
              <Link href="/review">待審核</Link>
            </nav>
          </div>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
