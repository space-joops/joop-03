import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

export type NavItem = "home" | "myJoop" | "inventory" | "map" | "settings";

function hrefFor(item: NavItem, lang: Locale): string {
  switch (item) {
    case "home":
      return `/${lang}`;
    case "myJoop":
      return `/${lang}/joop`;
    case "inventory":
      return `/${lang}/joop/inventory`;
    case "map":
      return `/${lang}/joop/map`;
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
    case "myJoop":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="7" width="12" height="10" rx="2" />
          <path d="M12 7V4" />
          <circle cx="10" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="14" cy="12" r="1.1" fill="currentColor" stroke="none" />
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
      className="mt-2 flex items-stretch gap-1 border-t px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2"
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
