// 하단 탭바 — handoff-m6.md §4-3 (미출시 탭·인터림 내비 규칙은 2026-07-27 보강판).
// 노출: 관리 화면(로그인 홈·내 줍스·청약·설정)에서만. 게임 장면·온보딩·미로그인 랜딩은 숨김(몰입 우선)
// → 페이지가 명시적으로 렌더한다(첫 화면은 myJoop 서버 데이터 조건부라 layout 전역 렌더 불가).
// 인터림 내비(M4 이전): 로그인 홈=궤도 대시보드, 지도 탭=홈. 인벤토리·랭킹은 미출시 탭(op .55 + 정보 토스트).
// 아이콘은 public/ui/icon-*.svg 와 동일 지오메트리의 인라인 SVG(currentColor 연동, sparkline.tsx 선례).
import Link from "next/link";
import type { ReactNode } from "react";
import { ComingSoonTab } from "@/components/tab-bar-coming-soon";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type TabKey = "map" | "inventory" | "ranking" | "settings";

function TabIcon({ tab }: { tab: TabKey }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 22,
    height: 22,
    "aria-hidden": true as const,
  };
  switch (tab) {
    case "map": // public/ui/icon-map.svg — 궤도 지도
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="square">
          <circle cx="12" cy="12" r="8" />
          <path d="M4.4 12h15.2M12 4.4v15.2" />
          <ellipse
            cx="12"
            cy="12"
            rx="8"
            ry="3.2"
            strokeWidth={1.5}
            opacity={0.7}
            transform="rotate(-24 12 12)"
          />
        </svg>
      );
    case "inventory": // public/ui/icon-inventory.svg — 수납함
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="square">
          <path d="M4 9 H20 V20 H4 Z" />
          <path d="M4 9 L6 4 H18 L20 9" />
          <path d="M9.5 13h5" />
        </svg>
      );
    case "ranking": // public/ui/icon-ranking.svg — 막대
      return (
        <svg {...common} fill="currentColor">
          <rect x="4" y="12" width="4" height="8" />
          <rect x="10" y="6" width="4" height="14" />
          <rect x="16" y="9" width="4" height="11" />
        </svg>
      );
    case "settings": // public/ui/icon-settings.svg — 콘솔 페이더
      return (
        <svg {...common}>
          <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="square">
            <path d="M6 4v16M12 4v16M18 4v16" />
          </g>
          <g fill="currentColor">
            <rect x="3.5" y="7" width="5" height="5" />
            <rect x="9.5" y="12" width="5" height="5" />
            <rect x="15.5" y="5" width="5" height="5" />
          </g>
        </svg>
      );
  }
}

function TabItem({
  label,
  active,
  href,
  children,
}: {
  label: string;
  active: boolean;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5"
      style={
        active
          ? { color: "var(--color-primary)", textShadow: "var(--glow-text)" }
          : { color: "var(--color-muted)" }
      }
    >
      <span
        className="grid place-items-center"
        style={active ? { filter: "drop-shadow(0 0 4px rgba(57, 255, 20, 0.45))" } : undefined}
      >
        {children}
      </span>
      <span className="text-[11px] leading-[14px]">{label}</span>
    </Link>
  );
}

export function TabBar({
  lang,
  tab,
  active,
}: {
  lang: Locale;
  tab: Dictionary["tab"];
  active?: TabKey;
}) {
  return (
    <nav
      aria-label={`${tab.map} · ${tab.inventory} · ${tab.ranking} · ${tab.settings}`}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-md border-t-2 pb-[env(safe-area-inset-bottom)]"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-neutral-700)",
        boxShadow: "inset 0 1px 0 var(--bezel-highlight)",
      }}
    >
      <TabItem label={tab.map} active={active === "map"} href={`/${lang}`}>
        <TabIcon tab="map" />
      </TabItem>
      <ComingSoonTab label={tab.inventory} ariaSuffix={tab.soon} message={tab.comingSoon}>
        <TabIcon tab="inventory" />
      </ComingSoonTab>
      <ComingSoonTab label={tab.ranking} ariaSuffix={tab.soon} message={tab.comingSoon}>
        <TabIcon tab="ranking" />
      </ComingSoonTab>
      <TabItem label={tab.settings} active={active === "settings"} href={`/${lang}/settings`}>
        <TabIcon tab="settings" />
      </TabItem>
    </nav>
  );
}
