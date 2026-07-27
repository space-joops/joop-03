import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { VersionBadge } from "../version-badge";
import { PwaPrompt } from "@/components/pwa-prompt";
import { locales, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import packageJson from "../../package.json";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 지원 로케일을 정적 생성 (docs/architecture/adr/0001-i18n.md)
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const metadata: Metadata = {
  title: "JOOPS — 함께 우주를 청소합니다",
  description: "지구 궤도의 우주 쓰레기를 청소하는 반려형 우주 로봇 게임",
  applicationName: "JOOPS",
  appleWebApp: {
    capable: true,
    title: "JOOPS",
    statusBarStyle: "black-translucent",
    // iOS 스플래시 — 해상도가 기기와 정확히 일치할 때만 적용되므로 기기별 5종
    // (docs/design/handoff-m1.md §3-2, 에셋 출처 PR #19). Android 는 매니페스트로 자동 생성.
    startupImage: [
      {
        url: "/brand/splash-1179x2556.png",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/brand/splash-1206x2622.png",
        media:
          "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/brand/splash-1290x2796.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/brand/splash-1320x2868.png",
        media:
          "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/brand/splash-1170x2532.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
    ],
  },
  formatDetection: { telephone: false, email: false, address: false },
};

// 모바일 세로 PWA (docs/architecture/adr/0002-pwa-portrait.md)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#030a05",
  colorScheme: "dark",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* crt-scanlines: 게임 트리 전용 CRT 오버레이 (admin 은 미적용) */}
      <body className="crt-scanlines min-h-full flex flex-col">
        {children}
        {/* PWA 설치 안내 + 새 배포 업데이트 안내 (게임 트리 전용, admin 미적용) */}
        <PwaPrompt dict={dict.pwa} currentVersion={packageJson.version} />
        <VersionBadge />
      </body>
    </html>
  );
}
