import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales, defaultLocale, isLocale } from "@/lib/i18n/config";

// ⚠️ 커스텀 Next.js 16: 구 middleware.ts 가 proxy.ts 로 개명됨. Node 런타임 전용.
// 로케일이 없는 경로를 감지해 /{locale} 로 리다이렉트한다.
// 영어 폴백은 getLocale()의 defaultLocale (docs/architecture/adr/0001-i18n.md).

function getLocale(request: NextRequest): string {
  // 1) 사용자가 고른 로케일(쿠키) 우선
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && isLocale(cookieLocale)) return cookieLocale;

  // 2) Accept-Language 경량 파싱 (2개 로케일이라 라이브러리 없이)
  const header = request.headers.get("accept-language");
  if (header) {
    const ranked = header
      .split(",")
      .map((part) => {
        const [tag, q] = part.trim().split(";q=");
        return { tag: tag.split("-")[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
      })
      .sort((a, b) => b.q - a.q);
    for (const { tag } of ranked) {
      if (isLocale(tag)) return tag;
    }
  }

  // 3) 폴백
  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return;

  const locale = getLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // _next 내부, /api, 확장자 있는 정적 파일(점 포함)은 제외
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
