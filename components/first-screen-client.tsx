"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { OrbitalSnapshot } from "@/lib/joops";
import type { RankingRow } from "@/lib/rankings";
import type { MyJoop } from "@/lib/profile";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { OrbitalCanvas } from "@/components/orbital-canvas";
import { CleanupGauge } from "@/components/cleanup-gauge";
import { RankingList } from "@/components/ranking-list";
import { LanguageSwitcher } from "@/components/language-switcher";
import { StatusBar } from "@/components/status-bar";

export function FirstScreen({
  lang,
  dict,
  initialSnapshot,
  rankings,
  myJoop,
}: {
  lang: Locale;
  dict: Dictionary;
  initialSnapshot: OrbitalSnapshot;
  rankings: RankingRow[];
  myJoop: MyJoop | null;
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
      {/* 장식 상태바 — safe-area 상단 패딩은 여기서 처리 */}
      <StatusBar />

      <header className="px-4 pb-2 pt-2">
        <div className="panel-amber flex items-center gap-3 px-3 py-2">
          {/* 브랜드 심볼 — 궤도 위 반려 로봇 (public/brand/logo-symbol.svg) */}
          <Image
            src="/brand/logo-symbol.svg"
            alt=""
            width={28}
            height={28}
            className="block h-7 w-7 shrink-0"
            aria-hidden
          />
          <span
            className="flex flex-1 items-center gap-2 text-[var(--color-primary)]"
            style={{ textShadow: "var(--glow-primary)" }}
          >
            <span aria-hidden className="speedlines" />
            <span className="font-mono text-lg font-semibold tracking-[0.2em]">
              {dict.common.appName}
            </span>
            <span aria-hidden className="speedlines" />
          </span>
          <LanguageSwitcher current={lang} />
        </div>
      </header>

      <div className="px-4">
        <div
          className="crt-brackets px-3 py-2"
          style={{ "--bracket-color": "var(--color-primary)" } as React.CSSProperties}
        >
          <p className="mb-2 text-center font-mono text-xs uppercase tracking-widest text-[var(--color-primary)]">
            {dict.firstScreen.orbitLabelTop}
          </p>
          <OrbitalCanvas snapshot={snapshot} />
          <p className="mt-2 text-center font-mono text-xs uppercase tracking-widest text-[var(--color-primary)]">
            {snapshot.joops.length} {dict.firstScreen.inOrbit}
          </p>
        </div>
        <p className="mt-1 text-center font-mono text-xs text-[var(--color-muted)]">
          {dict.firstScreen.title}
        </p>
      </div>

      <CleanupGauge totals={snapshot.totals} dict={dict} />
      <RankingList rows={rankings} dict={dict} />

      <div className="mt-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        {myJoop ? (
          <a
            href={`/${lang}/joop`}
            className="flex w-full items-center justify-center gap-2 rounded-md border py-3 font-mono text-sm"
            style={{ borderColor: "var(--color-neutral-600)", background: "var(--color-surface)" }}
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: myJoop.color, boxShadow: `0 0 6px ${myJoop.color}` }}
              aria-hidden
            />
            <span className="text-[var(--color-fg)]">
              {dict.home.myJoop}: {myJoop.name}
            </span>
            <span className="text-[var(--color-muted)]">
              · {myJoop.status === "orbit" ? dict.home.orbit : dict.home.ground} {dict.home.level}
              {myJoop.level}
            </span>
          </a>
        ) : (
          <a
            href={`/${lang}/onboarding`}
            className="block w-full rounded-md py-3 text-center font-mono text-sm font-semibold uppercase tracking-widest"
            style={{ background: "var(--color-primary)", color: "var(--color-bg)" }}
          >
            {dict.firstScreen.cta.startWithInvite}
          </a>
        )}
      </div>
    </main>
  );
}
