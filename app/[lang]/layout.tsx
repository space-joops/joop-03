import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

// 지원 로케일을 정적 생성 (docs/architecture/adr/0001-i18n.md)
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const metadata: Metadata = {
  title: "JOOPS — 함께 우주를 청소합니다",
  description: "지구 궤도의 우주 쓰레기를 청소하는 반려형 우주 로봇 게임",
  applicationName: "JOOPS",
  appleWebApp: { capable: true, title: "JOOPS", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
};

// 모바일 세로 PWA (docs/architecture/adr/0002-pwa-portrait.md)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#050810",
  colorScheme: "dark",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <VersionBadge />
      </body>
    </html>
  );
}
