import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Doto } from "next/font/google";
import { notFound } from "next/navigation";
import { VersionBadge } from "../version-badge";
import { locales, isLocale } from "@/lib/i18n/config";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 도트매트릭스 계기 폰트(--font-display). 숫자·라틴 대문자 전용이라 latin 서브셋만.
// docs/design/design-tokens.md §2-1: 한글·키릴 라벨에는 절대 쓰지 않는다.
const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
});

// 지원 로케일을 정적 생성 (docs/architecture/adr/0001-i18n.md)
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

// 스플래시 media 쿼리: [논리 폭] → 그 기기의 세로·DPR3 조건. 값은 handoff-m1.md §3-2 그대로.
const SPLASH_MEDIA: Record<number, string> = {
  390: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  393: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  402: "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  430: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  440: "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
};

export const metadata: Metadata = {
  title: "JOOPS — 함께 우주를 청소합니다",
  description: "지구 궤도의 우주 쓰레기를 청소하는 반려형 우주 로봇 게임",
  applicationName: "JOOPS",
  appleWebApp: {
    capable: true,
    title: "JOOPS",
    statusBarStyle: "black-translucent",
    // iOS 스타트업(스플래시) 이미지 — docs/design/handoff-m1.md §3-2 의 media 쿼리와 1:1.
    // iOS 는 기기 해상도가 정확히 일치할 때만 적용하고 아니면 무시한다(그래서 기기별 5종).
    // Android 는 매니페스트의 아이콘 + background_color 로 자동 생성하므로 파일이 필요 없다.
    startupImage: [
      { url: "/brand/splash-1170x2532.png", media: SPLASH_MEDIA[390] },
      { url: "/brand/splash-1179x2556.png", media: SPLASH_MEDIA[393] },
      { url: "/brand/splash-1206x2622.png", media: SPLASH_MEDIA[402] },
      { url: "/brand/splash-1290x2796.png", media: SPLASH_MEDIA[430] },
      { url: "/brand/splash-1320x2868.png", media: SPLASH_MEDIA[440] },
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
  themeColor: "#05080a", // app/globals.css 의 --color-bg 와 동일값
  colorScheme: "dark",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} ${doto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <VersionBadge />
      </body>
    </html>
  );
}
