import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { VersionBadge } from "../version-badge";
import "../globals.css";

// 관리자 콘솔의 루트 레이아웃.
// app/ 에 layout.tsx 가 없어 app/[lang]/layout.tsx 와 이 파일이 각각 자기 서브트리의
// 루트 레이아웃이 된다(다중 루트 레이아웃 — node_modules/next/dist/docs 의 layout.md 참조).
// 그래서 여기서 <html>/<body> 를 직접 렌더하며, 게임의 PWA 세로 고정 viewport 를 상속하지 않는다.
//
// ⚠️ 인증 가드는 여기 두지 않는다. 여기에 두면 /admin/login 까지 막혀 무한 리다이렉트가 된다.
//    가드는 app/admin/(protected)/layout.tsx 에 있다.

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "줍스 관리자 콘솔",
  // 운영자 전용 화면이므로 검색엔진에 노출하지 않는다.
  robots: { index: false, follow: false },
};

// 게임(모바일 세로 전용)과 달리 데스크톱 운영 화면이라 확대 제한을 두지 않는다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#030a05",
  colorScheme: "dark",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <VersionBadge />
      </body>
    </html>
  );
}
