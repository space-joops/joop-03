"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { DebrisIcon } from "@joop/arcade-engine";
import { ARCADE_DEBRIS } from "@joop/arcade-engine";
import {
  parseKindCounts,
  readKindStoreSnapshot,
  subscribeKindStore,
  type DebrisKindId,
} from "@joop/arcade-engine";
import { parseAdDocks, readAdDockSnapshot, subscribeAdDocks } from "@/lib/ad-docks";
import { AD_SATELLITES } from "@joop/arcade-engine";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

// 인벤토리 — 데이터가 전부 localStorage 라 서버 조회가 없다.
// SSR 스냅샷은 "" → 첫 렌더는 빈 상태와 같은 마크업이라 하이드레이션 안전(debris-kinds 관용구).
// ⚠️ 초대코드는 복사 대상이므로 .game-surface(user-select:none)로 감싸지 말 것.

/**
 * 공유: navigator.share 우선 → clipboard 폴백. 반환 = 사용자 피드백 종류.
 * url 을 text 에 섞지 않고 별도 필드로 넘긴다 — 카카오톡 등 공유 시트가 이 필드로
 * 링크 미리보기(OG 카드)를 만든다. clipboard 폴백은 필드가 없어 텍스트에 이어붙인다.
 */
async function shareCode(text: string, url: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ text, url });
      return "shared";
    }
  } catch (e) {
    // 사용자가 공유 시트를 닫은 것(AbortError)은 실패가 아니다 — 조용히 끝낸다
    if (e instanceof DOMException && e.name === "AbortError") return "shared";
    // 그 외(권한 등)는 clipboard 로 폴백
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return "copied";
  } catch {
    return "failed"; // 최후 수단: 코드 박스가 select-all 이라 길게 눌러 복사 가능
  }
}

export function InventoryView({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const inv = dict.inventory;
  const kindsRaw = useSyncExternalStore(subscribeKindStore, readKindStoreSnapshot, () => "");
  const docksRaw = useSyncExternalStore(subscribeAdDocks, readAdDockSnapshot, () => "");
  const counts = parseKindCounts(kindsRaw);
  const docks = parseAdDocks(docksRaw);
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  // 복사/공유 피드백 — 브랜드별 2초 표시
  const [feedback, setFeedback] = useState<{ brandId: string; text: string } | null>(null);
  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), 2000);
    return () => clearTimeout(id);
  }, [feedback]);

  const panelStyle = { borderColor: "var(--color-grid)" } as const;

  return (
    <div className="flex flex-col gap-4 px-4 pb-8">
      {/* ── 수집 쓰레기 ── */}
      <section className="rounded-md border p-3" style={panelStyle}>
        <h2 className="mb-1 font-mono text-xs uppercase tracking-widest text-[var(--color-secondary)]">
          {inv.debrisTitle}
        </h2>
        <p className="mb-3 font-mono text-[10px] leading-relaxed text-[var(--color-muted)]">
          {inv.debrisHint}
        </p>
        {total === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="font-mono text-xs text-[var(--color-muted)]">{inv.debrisEmpty}</p>
            <Link
              href={`/${lang}/joop/arcade`}
              className="font-mono text-xs text-[var(--color-primary)] underline underline-offset-2"
            >
              {inv.toArcade} →
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {ARCADE_DEBRIS.map((d) => {
              const n = counts[d.id as DebrisKindId] ?? 0;
              const name = inv.kinds[d.id as DebrisKindId];
              return (
                <li
                  key={d.id}
                  className="flex flex-col items-center gap-1 rounded-md border py-2"
                  style={{ ...panelStyle, opacity: n > 0 ? 1 : 0.4 }}
                >
                  <DebrisIcon kind={d.id as DebrisKindId} size={28} />
                  <span className="font-mono text-[10px] text-[var(--color-fg)]">{name}</span>
                  <span className="font-mono text-sm font-semibold text-[var(--color-primary)]">
                    {n.toLocaleString()}
                    <span className="ml-0.5 text-[9px] font-normal text-[var(--color-muted)]">
                      {inv.unitSuffix}
                    </span>
                  </span>
                  <span className="font-mono text-[9px] text-[var(--color-muted)]">
                    {d.value} {inv.valueSuffix}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── 도킹한 광고 위성 ── */}
      <section className="rounded-md border p-3" style={panelStyle}>
        <h2 className="mb-1 font-mono text-xs uppercase tracking-widest text-[var(--color-secondary)]">
          {inv.satTitle}
        </h2>
        <p className="mb-3 font-mono text-[10px] leading-relaxed text-[var(--color-muted)]">
          {inv.satHint}
        </p>
        <ul className="flex flex-col gap-2">
          {AD_SATELLITES.map((sat) => {
            const dock = docks.find((r) => r.brandId === sat.id) ?? null;
            if (!dock) {
              return (
                <li
                  key={sat.id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 opacity-45"
                  style={panelStyle}
                >
                  {/* 잠금 실루엣 — brightness(0) 으로 형태만 남긴다 */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- 게임과 같은 로컬 SVG(최적화 불필요) */}
                  <img
                    src={sat.asset}
                    alt=""
                    className="h-8 w-16 object-contain"
                    style={{ filter: "brightness(0) invert(0.4)" }}
                  />
                  <span className="flex-1 font-mono text-xs text-[var(--color-fg)]">{sat.brand}</span>
                  <span className="font-mono text-[10px] text-[var(--color-muted)]">{inv.satLocked}</span>
                </li>
              );
            }
            const shareText = inv.shareText.replace("{code}", dock.code);
            // 하드코딩 도메인 대신 현재 접속 origin — 배포 도메인이 바뀌어도 항상 일치한다.
            const shareUrl =
              typeof window !== "undefined"
                ? `${window.location.origin}/${lang}/onboarding?code=${encodeURIComponent(dock.code)}`
                : "";
            const fb = feedback?.brandId === sat.id ? feedback.text : null;
            return (
              <li
                key={sat.id}
                className="flex flex-col gap-2 rounded-md border px-3 py-2.5"
                style={{ borderColor: sat.color }}
              >
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 게임과 같은 로컬 SVG(최적화 불필요) */}
                  <img src={sat.asset} alt="" className="h-10 w-20 object-contain" />
                  <div className="flex-1">
                    <p className="font-mono text-sm font-semibold" style={{ color: sat.color }}>
                      {sat.brand}
                    </p>
                    <p className="font-mono text-[10px] text-[var(--color-muted)]">
                      {inv.dockedAt}{" "}
                      {new Date(dock.dockedAt).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
                    {inv.code}
                  </span>
                  {/* select-all — 버튼이 실패해도 길게 눌러 직접 복사할 수 있는 최후 수단 */}
                  <code
                    className="flex-1 select-all rounded-sm border px-2 py-1 font-mono text-sm tracking-wider text-[var(--color-fg)]"
                    style={panelStyle}
                  >
                    {dock.code}
                  </code>
                </div>
                <div className="flex items-center justify-end gap-2">
                  {fb && (
                    <span className="font-mono text-[10px] text-[var(--color-success)]" role="status">
                      {fb}
                    </span>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(dock.code);
                        setFeedback({ brandId: sat.id, text: inv.copied });
                      } catch {
                        /* select-all 코드 박스가 폴백 */
                      }
                    }}
                    className="rounded-md border px-3 py-1 font-mono text-[11px] uppercase tracking-widest"
                    style={{ borderColor: "var(--color-neutral-600)", color: "var(--color-fg)" }}
                  >
                    {inv.copy}
                  </button>
                  <button
                    onClick={async () => {
                      const r = await shareCode(shareText, shareUrl);
                      if (r === "copied") setFeedback({ brandId: sat.id, text: inv.copied });
                    }}
                    className="rounded-md px-3 py-1 font-mono text-[11px] uppercase tracking-widest"
                    style={{ background: "var(--color-primary)", color: "var(--color-bg)" }}
                  >
                    {inv.share}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
