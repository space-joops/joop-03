"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OrbitState } from "@/lib/space";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

// 교신 상태 패널 — "언제 음영을 지나 통신이 되는지" 한눈에.
// 서버가 준 nextChangeAt(실제 epoch ms)만으로 실시간 카운트다운한다. 게임 배속·음영 비율은
// 서버 config 에서 이미 반영된 값이라 클라는 남은 시간만 세면 된다.
export function LinkStatus({
  state,
  dict,
  lang,
  shadowXpCost,
  myXp,
}: {
  state: OrbitState;
  dict: Dictionary;
  lang: Locale;
  /** 음영 중 진입 비용(XP). 0이면 무료 */
  shadowXpCost: number;
  myXp: number;
}) {
  const t = dict.space;
  const a = dict.arcade;
  // 0.5초마다 현재 시각만 갱신하고 남은 시간은 렌더에서 파생한다.
  // 초기값을 서버 시각으로 두면 SSR/CSR 첫 렌더가 일치해 하이드레이션 경고가 없다.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const remainMs = Math.max(0, state.nextChangeAt - (nowMs ?? state.serverTime));
  const totalSec = Math.ceil(remainMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");

  // 진행 바 — 화면을 열었을 때의 남은 시간을 100%로 삼아 채워 나간다.
  const spanMs = Math.max(1000, state.nextChangeAt - state.serverTime);
  const progress = Math.max(0, Math.min(1, 1 - remainMs / spanMs));

  const tone = state.inShadow ? "var(--color-secondary)" : "var(--color-primary)";
  const canAfford = myXp >= shadowXpCost;

  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: tone, background: "var(--color-surface)" }}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
          {t.link}
        </span>
        <span className="font-mono text-sm font-semibold" style={{ color: tone }}>
          {state.inShadow ? t.shadowAuto : t.linkActive}
        </span>
      </div>

      <p className="mt-2 font-mono text-xs text-[var(--color-fg)]">
        {state.inShadow ? t.linkIn : t.shadowIn}{" "}
        <span className="text-base font-semibold" style={{ color: tone }}>
          T-{mm}:{ss}
        </span>
      </p>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-neutral-700)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-linear"
          style={{ width: `${progress * 100}%`, background: tone }}
        />
      </div>

      <p className="mt-2 font-mono text-[10px] leading-relaxed text-[var(--color-muted)]">
        {t.passInfo.replace("{speed}", String(state.gameSpeed))}
      </p>

      {/* 초기 개발 단계: 음영이어도 XP 를 지불하면 바로 플레이할 수 있다 */}
      <Link
        href={`/${lang}/joop/arcade`}
        className="mt-3 block w-full rounded-md py-2.5 text-center font-mono text-xs font-semibold uppercase tracking-widest"
        style={
          state.inShadow && !canAfford
            ? { background: "var(--color-neutral-700)", color: "var(--color-muted)" }
            : { background: "var(--color-primary)", color: "var(--color-bg)" }
        }
      >
        {!state.inShadow
          ? a.enter
          : shadowXpCost === 0
            ? a.enter
            : a.payShadowEnter.replace("{cost}", String(shadowXpCost))}
      </Link>
      {state.inShadow && shadowXpCost > 0 && (
        <p className="mt-1 text-center font-mono text-[10px] text-[var(--color-muted)]">
          {canAfford
            ? a.xpBalance.replace("{xp}", String(myXp))
            : a.insufficientXp.replace("{cost}", String(shadowXpCost)).replace("{xp}", String(myXp))}
        </p>
      )}
    </div>
  );
}
