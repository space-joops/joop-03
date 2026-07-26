"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { OrbitalSnapshot } from "@/lib/joops";
import type { RankingRow } from "@/lib/rankings";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { OrbitalCanvas } from "@/components/orbital-canvas";
import { CleanupGauge } from "@/components/cleanup-gauge";
import { RankingList } from "@/components/ranking-list";
import { LanguageSwitcher } from "@/components/language-switcher";

export function FirstScreen({
  lang,
  dict,
  initialSnapshot,
  rankings,
}: {
  lang: Locale;
  dict: Dictionary;
  initialSnapshot: OrbitalSnapshot;
  rankings: RankingRow[];
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  // 서버 스냅샷 주기(기본 10초)마다 폴링해 갱신. 렌더 보간은 Canvas가 rAF로.
  useEffect(() => {
    const interval = Math.max(2, initialSnapshot.tickSeconds || 10) * 1000;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/orbital", { cache: "no-store" });
        if (res.ok) setSnapshot((await res.json()) as OrbitalSnapshot);
      } catch {
        // 폴링 실패는 조용히 무시(다음 주기 재시도)
      }
    }, interval);
    return () => clearInterval(id);
  }, [initialSnapshot.tickSeconds]);

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col"
      style={{ background: "var(--color-bg)" }}
    >
      <header className="flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="flex items-center gap-2">
          {/* 브랜드 심볼 — 궤도 위 반려 로봇 (public/brand/logo-symbol.svg) */}
          <Image
            src="/brand/logo-symbol.svg"
            alt=""
            width={28}
            height={28}
            className="block h-7 w-7"
            aria-hidden
          />
          <span className="font-mono text-lg font-semibold tracking-[0.2em] text-[var(--color-primary)]">
            {dict.common.appName}
          </span>
        </span>
        <LanguageSwitcher current={lang} />
      </header>

      <div className="px-4">
        <p className="mb-2 text-center font-mono text-sm text-[var(--color-fg)]">
          {dict.firstScreen.title}
        </p>
        <OrbitalCanvas snapshot={snapshot} />
        <p className="mt-1 text-center font-mono text-xs text-[var(--color-muted)]">
          {snapshot.joops.length} {dict.firstScreen.inOrbit}
        </p>
      </div>

      <CleanupGauge totals={snapshot.totals} dict={dict} />
      <RankingList rows={rankings} dict={dict} />

      <div className="mt-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        <a
          href={`/${lang}/onboarding`}
          className="block w-full rounded-md py-3 text-center font-mono text-sm font-semibold uppercase tracking-widest"
          style={{ background: "var(--color-primary)", color: "var(--color-bg)" }}
        >
          {dict.firstScreen.cta.startWithInvite}
        </a>
      </div>
    </main>
  );
}
