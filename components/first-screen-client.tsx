"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { OrbitalSnapshot } from "@/lib/joops";
import type { RankingRow } from "@/lib/rankings";
import type { MyJoop } from "@/lib/profile";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { OrbitViewer, useOrbitalSnapshot } from "@/components/orbit-viewer";
import { CleanupGauge } from "@/components/cleanup-gauge";
import { RankingList } from "@/components/ranking-list";
import { LanguageSwitcher } from "@/components/language-switcher";
import { StatusBar } from "@/components/status-bar";
import { trackSetupCompleted } from "@/lib/analytics";

export function FirstScreen({
  lang,
  dict,
  initialSnapshot,
  rankings,
  myRanking = null,
  myJoop,
  gameSpeed,
  shadowFraction,
}: {
  lang: Locale;
  dict: Dictionary;
  initialSnapshot: OrbitalSnapshot;
  rankings: RankingRow[];
  myRanking?: RankingRow | null;
  myJoop: MyJoop | null;
  /** 궤도 게임 배속(config orbit_game_speed) — 우주 지도와 같은 속도를 쓰기 위해 서버가 주입 */
  gameSpeed: number;
  /** 음영 비율(config shadow_fraction) — 교신 지표가 서버 판정과 일치하도록 */
  shadowFraction: number;
}) {
  const snapshot = useOrbitalSnapshot(initialSnapshot);

  // 온보딩 설정 완료(completeSetup)의 성공은 서버에서 바로 redirect되어 클라에 성공
  // 상태가 안 보이므로, 도착한 이 페이지에서 1회성 쿼리 신호(?setup=done)로 대신 잡는다.
  const trackedSetup = useRef(false);
  useEffect(() => {
    if (trackedSetup.current) return;
    if (new URLSearchParams(window.location.search).get("setup") !== "done") return;
    trackedSetup.current = true;
    trackSetupCompleted();
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col"
      style={{ background: "var(--color-bg)" }}
    >
      {/* 장식 상태바 — safe-area 상단 패딩은 여기서 처리 */}
      <StatusBar />

      <header className="px-4 pb-1.5 pt-1.5">
        <div className="panel-amber flex items-center gap-3 px-3 py-1.5">
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
          className="crt-brackets px-3 py-1.5"
          style={{ "--bracket-color": "var(--color-primary)" } as React.CSSProperties}
        >
          <p className="mb-1 text-center font-mono text-xs uppercase tracking-widest text-[var(--color-primary)]">
            {dict.firstScreen.orbitLabelTop}
          </p>

          <OrbitViewer
            snapshot={snapshot}
            myJoopId={myJoop?.status === "orbit" ? myJoop.id : null}
            myColor={myJoop?.color ?? null}
            gameSpeed={gameSpeed}
            shadowFraction={shadowFraction}
            lang={lang}
            dict={dict}
            layout="toggle"
          />

          <p className="mt-1.5 text-center font-mono text-xs uppercase tracking-widest text-[var(--color-primary)]">
            {snapshot.joops.length} {dict.firstScreen.inOrbit}
            <span className="ml-2 normal-case tracking-normal text-[var(--color-muted)]">
              · {dict.firstScreen.title}
            </span>
          </p>
        </div>
      </div>

      <CleanupGauge totals={snapshot.totals} dict={dict} />
      <RankingList rows={rankings} dict={dict} lang={lang} myRanking={myRanking} showMore />

      <div className="mt-auto flex flex-col gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2">
        {/* 진입 단축(UX): 궤도에 있으면 첫 화면에서 아케이드로 1탭 직행 */}
        {myJoop?.status === "orbit" && (
          <a
            href={`/${lang}/joop/arcade`}
            className="block w-full rounded-md py-2.5 text-center font-mono text-sm font-semibold uppercase tracking-widest"
            style={{ background: "var(--color-primary)", color: "var(--color-bg)" }}
          >
            {dict.firstScreen.cta.arcade}
          </a>
        )}
        {myJoop ? (
          <a
            href={`/${lang}/joop`}
            className="flex w-full items-center justify-center gap-2 rounded-md border py-2.5 font-mono text-sm"
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
