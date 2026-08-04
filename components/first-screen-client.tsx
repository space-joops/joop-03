"use client";

import { useEffect, useRef } from "react";
import type { OrbitalSnapshot } from "@/lib/joops";
import type { RankingRow } from "@/lib/rankings";
import type { MyJoop } from "@/lib/profile";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { OrbitViewer, useOrbitalSnapshot } from "@/components/orbit-viewer";
import { CleanupGauge } from "@/components/cleanup-gauge";
import { RankingList } from "@/components/ranking-list";
import { BottomNav, withLaunchOrMap } from "@/components/bottom-nav";
import { trackSetupCompleted } from "@/lib/analytics";
import { JoopSprite } from "@/components/joop-sprite";
import Link from "next/link";
import { ReplayLaunchButton } from "@/components/replay-launch-button";

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

  const j = dict.joop;
  const statusLabel = myJoop
    ? myJoop.status === "orbit"
      ? dict.home.orbit
      : dict.home.ground
    : "";

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col pb-24 pt-[calc(env(safe-area-inset-top)+1rem)] gap-4"
      style={{ background: "var(--color-bg)" }}
    >
      {myJoop ? (
        <div className="px-4">
          <section
            className="rounded-lg border p-4 mb-3"
            style={{ borderColor: "var(--color-neutral-600)", background: "var(--color-surface)" }}
          >
            <div className="flex flex-col items-center gap-3">
              <div
                className="crt-brackets p-3"
                style={{ "--bracket-color": myJoop.color } as React.CSSProperties}
              >
                <JoopSprite color={myJoop.color} size={96} className="pixelated" />
              </div>
              <div className="flex w-full min-w-0 items-center justify-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: myJoop.color, boxShadow: `0 0 8px ${myJoop.color}` }}
                  aria-hidden
                />
                <span className="min-w-0 truncate font-mono text-lg font-semibold text-[var(--color-fg)]">
                  {myJoop.name}
                </span>
                <span className="shrink-0 font-mono text-xs text-[var(--color-muted)]">
                  {statusLabel}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
              <span>
                {dict.home.level} {myJoop.level}
              </span>
              <span>{myJoop.xpIntoLevel}/100 XP</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--color-neutral-700)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${myJoop.xpIntoLevel}%`,
                  background: "var(--color-primary)",
                  boxShadow: "var(--glow-primary)",
                }}
              />
            </div>
            <p className="mt-3 text-center font-mono text-[10px] leading-relaxed text-[var(--color-muted)]">
              {myJoop.status === "orbit" ? j.hintOrbit : myJoop.status === "queued" ? j.hintQueued : j.hint}
            </p>
          </section>

          <div className="flex flex-col gap-2">
            {myJoop.status === "orbit" ? (
              <>
                <Link href={`/${lang}/joop/arcade`} className="crt-brackets btn-brackets" style={{ "--bracket-color": "var(--color-primary)", color: "var(--color-primary)" } as React.CSSProperties}>{j.arcadeNow}</Link>
                <div className="flex gap-2">
                  <Link href={`/${lang}/joop/inventory`} className="flex-1 crt-brackets btn-brackets" style={{ "--bracket-color": "var(--color-neutral-500)" } as React.CSSProperties}>{j.inventory}</Link>
                  <Link href={`/${lang}/joop/map`} className="flex-1 crt-brackets btn-brackets" style={{ "--bracket-color": "var(--color-neutral-500)" } as React.CSSProperties}>{j.openMap}</Link>
                </div>
                <ReplayLaunchButton lang={lang} dict={dict} />
              </>
            ) : myJoop.status === "queued" ? (
              <Link href={`/${lang}/joop/launch`} className="crt-brackets btn-brackets" style={{ "--bracket-color": "var(--color-primary)", color: "var(--color-primary)" } as React.CSSProperties}>{j.launchNow}</Link>
            ) : (
              <Link href={`/${lang}/joop/train`} className="crt-brackets btn-brackets" style={{ "--bracket-color": "var(--color-primary)", color: "var(--color-primary)" } as React.CSSProperties}>{j.train}</Link>
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 mt-2 mb-2 text-center">
          <p className="font-mono text-xs leading-relaxed text-[var(--color-muted)]">
            우주 쓰레기를 수거하는 반려 로봇을 분양받아<br/>다 함께 지구 저궤도를 청소해요.
          </p>
        </div>
      )}

      <div className="px-4">
        <div
          className="crt-brackets px-3 py-1.5"
          style={{ "--bracket-color": "var(--color-neutral-400)" } as React.CSSProperties}
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

      {!myJoop && (
        <div className="mt-auto flex flex-col gap-2 px-4 pt-2">
          <a
            href={`/${lang}/onboarding`}
            className="block w-full rounded-md py-3 text-center font-mono text-sm font-semibold uppercase tracking-widest"
            style={{ background: "var(--color-primary)", color: "var(--color-bg)" }}
          >
            {dict.firstScreen.cta.startWithInvite}
          </a>
        </div>
      )}

      <BottomNav
        lang={lang}
        dict={dict}
        items={myJoop ? withLaunchOrMap(["home", "inventory", "map", "settings"], myJoop.status === "orbit") : ["home", "settings"]}
        active="home"
      />
    </main>
  );
}
