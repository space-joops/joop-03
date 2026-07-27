import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleTagManager } from "@next/third-parties/google";
import { notFound } from "next/navigation";
import { VersionBadge } from "../version-badge";
import { PwaPrompt } from "@/components/pwa-prompt";
import { SplashScreen } from "@/components/splash-screen";
import { locales, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import packageJson from "../../package.json";
import "../globals.css";

// Google Tag Manager — 게임 트리 전용(admin 콘솔은 이미 robots noindex라 추적 제외).
// 동의 배너는 아직 없음(전 지역 즉시 적용으로 결정).
const GTM_ID = "GTM-NV8BSHG2";

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

// OG 프리뷰(카톡/슬랙/트위터 공유)용 이미지는 public/og/opengraph-image.jpg를 명시 참조한다.
// ⚠️ app/[lang]/opengraph-image.jpg 같은 파일 기반 컨벤션은 쓰지 않는다 — generateStaticParams가
// 있는 동적 [lang] 세그먼트 안에 두면 Vercel 빌드에서 prerender invariant 오류가 난다
// (scripts/generate-og-image.mjs 상단 주석 참고). 소스: public/design-src/og/joops-cover-source.jpg.
const OG_IMAGE = {
  url: "/og/opengraph-image.jpg",
  width: 1200,
  height: 630,
  alt: "JOOPS Unit — a pet space robot floating in orbit, surrounded by small space debris",
};

// iOS 스플래시 — 해상도가 기기와 정확히 일치할 때만 적용되므로 기기별 5종
// (docs/design/handoff-m1.md §3-2, 에셋 출처 PR #19). Android 는 매니페스트로 자동 생성.
const APPLE_STARTUP_IMAGES = [
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
];

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const { title, description } = dict.meta;
  const url = `https://joop-03.vercel.app/${lang}`;

  return {
    metadataBase: new URL("https://joop-03.vercel.app"),
    title,
    description,
    applicationName: "JOOPS",
    appleWebApp: {
      capable: true,
      title: "JOOPS",
      statusBarStyle: "black-translucent",
      startupImage: APPLE_STARTUP_IMAGES,
    },
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: {
      title,
      description,
      url,
      siteName: "JOOPS",
      locale: lang === "ko" ? "ko_KR" : "en_US",
      type: "website",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
  };
}

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
      <GoogleTagManager gtmId={GTM_ID} />
      {/* crt-scanlines: 게임 트리 전용 CRT 오버레이 (admin 은 미적용) */}
      <body className="crt-scanlines min-h-full flex flex-col">
        {children}
        {/* 인앱 스플래시 — 매 방문(전체 로드)마다, 스킵 가능 (admin 미적용) */}
        <SplashScreen appName={dict.common.appName} skipLabel={dict.common.skip} />
        {/* PWA 설치 안내 + 새 배포 업데이트 안내 (게임 트리 전용, admin 미적용) */}
        <PwaPrompt dict={dict.pwa} currentVersion={packageJson.version} />
        <VersionBadge />
      </body>
    </html>
  );
}
