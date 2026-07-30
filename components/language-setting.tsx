"use client";

import { usePathname, useRouter } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// 선호 로케일을 쿠키에 저장 (proxy 가 다음 방문 시 읽음). 모듈 레벨 부작용 함수.
function persistLocale(loc: Locale) {
  document.cookie = `NEXT_LOCALE=${loc}; path=/; max-age=31536000; samesite=lax`;
}

// 쿠키 삭제 → 다음 요청부터 proxy.ts 가 Accept-Language 로 다시 자동 감지한다.
function clearLocale() {
  document.cookie = "NEXT_LOCALE=; path=/; max-age=0; samesite=lax";
}

export function LanguageSetting({ current, dict }: { current: Locale; dict: Dictionary }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = dict.language;

  const switchTo = (loc: Locale) => {
    if (loc === current) return;
    persistLocale(loc);
    // 현재 경로의 첫 세그먼트(로케일)를 교체. 배열 뮤테이션 없이 with() 사용.
    const segments = pathname.split("/").with(1, loc);
    router.push(segments.join("/") || `/${loc}`);
  };

  const switchToAuto = () => {
    clearLocale();
    router.push("/");
  };

  return (
    <section
      className="crt-brackets px-3 py-2"
      style={{ "--bracket-color": "var(--color-neutral-600)" } as React.CSSProperties}
    >
      <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--color-secondary)]">
        {dict.settings.language.title}
      </h2>
      <div className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
        <button
          type="button"
          onClick={switchToAuto}
          className="rounded-md px-2 py-1.5 text-left font-mono text-xs"
          style={{ background: "var(--color-surface)", color: "var(--color-fg)" }}
        >
          {t.auto}
        </button>
        {locales.map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => switchTo(loc)}
            aria-current={loc === current ? "true" : undefined}
            className="rounded-md px-2 py-1.5 text-left font-mono text-xs"
            style={{
              background: "var(--color-surface)",
              color: loc === current ? "var(--color-primary)" : "var(--color-fg)",
            }}
          >
            {t[loc]}
          </button>
        ))}
      </div>
    </section>
  );
}
