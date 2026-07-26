"use client";

import { usePathname, useRouter } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n/config";

// 선호 로케일을 쿠키에 저장 (proxy 가 다음 방문 시 읽음). 모듈 레벨 부작용 함수.
function persistLocale(loc: Locale) {
  document.cookie = `NEXT_LOCALE=${loc}; path=/; max-age=31536000; samesite=lax`;
}

// 로케일 전환: 쿠키 저장 + 현재 경로의 첫 세그먼트를 교체.
export function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  const switchTo = (loc: Locale) => {
    if (loc === current) return;
    persistLocale(loc);
    // 현재 경로의 첫 세그먼트(로케일)를 교체. 배열 뮤테이션 없이 with() 사용.
    const segments = pathname.split("/").with(1, loc);
    router.push(segments.join("/") || `/${loc}`);
  };

  return (
    <div className="flex items-center gap-1 font-mono text-xs">
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => switchTo(loc)}
          aria-current={loc === current ? "true" : undefined}
          className="px-1.5 py-0.5 uppercase"
          style={{ color: loc === current ? "var(--color-primary)" : "var(--color-muted)" }}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
