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

// OG 프리뷰(카톡/슬랙/트위터 공유)용 이미지는 app/[lang]/opengraph-image.jpg,
// twitter-image.jpg 파일 기반 컨벤션으로 자동 주입된다(og:image 등).
// 소스: public/design-src/og/joops-cover-source.jpg → scripts/generate-og-image.mjs.
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
    appleWebApp: { capable: true, title: "JOOPS", statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: {
      title,
      description,
      url,
      siteName: "JOOPS",
      locale: lang === "ko" ? "ko_KR" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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
