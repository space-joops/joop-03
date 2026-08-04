import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

export type NavItem = "home" | "inventory" | "map" | "launch" | "settings";

// 발사 전(궤도 진입 전)엔 "우주지도" 탭을 눌러도 map/page.tsx 가드가 바로 /joop 로
// 튕겨내므로, 그 자리를 "발사 청약" 탭으로 대체한다.
export function withLaunchOrMap(items: NavItem[], inOrbit: boolean): NavItem[] {
  return items.map((item) => (item === "map" ? (inOrbit ? "map" : "launch") : item));
}

function hrefFor(item: NavItem, lang: Locale): string {
  switch (item) {
    case "home":
      return `/${lang}`;
    case "inventory":
      return `/${lang}/joop/inventory`;
    case "map":
      return `/${lang}/joop/map`;
    case "launch":
      return `/${lang}/launch`;
    case "settings":
      return `/${lang}/settings`;
  }
}

function Icon({ item }: { item: NavItem }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };
  switch (item) {
    case "home":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11l8-7 8 7" />
          <path d="M6 10v9h12v-9" />
        </svg>
      );
    case "inventory":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8l8-4 8 4-8 4-8-4z" />
          <path d="M4 8v8l8 4 8-4V8" />
          <path d="M12 12v8" />
        </svg>
      );
    case "map":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8" />
          <path d="M4 12h16" />
          <path d="M12 4c3 4 3 12 0 16" />
          <path d="M12 4c-3 4-3 12 0 16" />
        </svg>
      );
    case "launch":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3c2.5 2 3.5 5.5 2.8 10.2l-2.8 2.6-2.8-2.6C8.5 8.5 9.5 5 12 3z" />
          <path d="M9.2 13.8L6.5 16l.6 2.8 2.6-1.9" />
          <path d="M14.8 13.8l2.7 2.2-.6 2.8-2.6-1.9" />
          <circle cx="12" cy="9" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="square">
          <path d="M6 4v16M12 4v16M18 4v16" />
          <rect x="3.5" y="7" width="5" height="5" fill="currentColor" stroke="none" />
          <rect x="9.5" y="12" width="5" height="5" fill="currentColor" stroke="none" />
          <rect x="15.5" y="5" width="5" height="5" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

// 하단 버튼 메뉴 — 핵심 3화면(첫 화면/내 줍스 허브/설정)에만 적용.
// 첫 화면은 자기 자신(홈)을 제외한 4개 항목만, 나머지는 홈 포함 5개 항목을 넘겨받는다.
export function BottomNav({
  lang,
  dict,
  items,
  active,
}: {
  lang: Locale;
  dict: Dictionary;
  items: NavItem[];
  active?: NavItem;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-md items-stretch gap-1 border-t px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2"
      style={{ borderColor: "var(--color-neutral-700)", background: "var(--color-bg)" }}
    >
      {items.map((item) => (
        <Link
          key={item}
          href={hrefFor(item, lang)}
          aria-current={item === active ? "page" : undefined}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 font-mono text-[10px] uppercase tracking-wide"
          style={{ color: item === active ? "var(--color-primary)" : "var(--color-muted)" }}
        >
          <Icon item={item} />
          {dict.nav[item]}
        </Link>
      ))}
    </nav>
  );
}
