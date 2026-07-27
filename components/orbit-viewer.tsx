"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { OrbitalCanvas } from "@/components/orbital-canvas";
import { OrbitTrackMap } from "@/components/orbit-track-map";
import { createOrbitClock } from "@/lib/orbit-clock";
import type { OrbitalSnapshot } from "@/lib/joops";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

// 첫 화면과 우주 지도가 **같은 지구본**을 쓰도록 뽑아낸 공용 뷰어.
//   layout="toggle" — 지구본 ⇄ 궤도 추적 전환(첫 화면: 세로 공간이 빡빡하다)
//   layout="stack"  — 지구본 위 + 궤도 추적 아래(우주 지도: 한눈에 다 본다)
//
// 배속은 두 겹이다.
//   1) 궤도 게임 배속(gameSpeed) — 서버 config orbit_game_speed. 음영 판정과 같은 값이라
//      화면과 상태가 어긋나지 않는다. 모든 화면에 공통 적용된다.
//   2) 관측 배속(VIEW_STEPS) — 사용자가 "빨리 돌려보는" 로컬 배속. 1× 면 게임 시각 그대로라
//      첫 화면과 우주 지도가 정확히 같은 속도로 움직인다.

const VIEW_STEPS = [1, 2, 8, 32] as const;
const DEFAULT_VIEW_INDEX = 0;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false, // SSR 폴백
  );
}

export function OrbitViewer({
  snapshot,
  myJoopId = null,
  myColor = null,
  gameSpeed,
  shadowFraction = 0.5,
  lang,
  dict,
  layout = "toggle",
}: {
  snapshot: OrbitalSnapshot;
  /** 강조할 내 줍스 — 애니메이션 스프라이트 + 궤도 링으로 그린다 */
  myJoopId?: string | null;
  myColor?: string | null;
  /** 궤도 게임 배속(서버 config). 음영 판정과 동일한 값이어야 한다. */
  gameSpeed: number;
  /** 음영 비율(서버 config) — 추적 지도의 교신 지표가 서버 판정과 일치하도록 */
  shadowFraction?: number;
  lang: Locale;
  dict: Dictionary;
  layout?: "toggle" | "stack";
}) {
  const [view, setView] = useState<"globe" | "track">("globe");
  const [viewIdx, setViewIdx] = useState(DEFAULT_VIEW_INDEX);
  const reducedMotion = useReducedMotion();
  // 가상 시계(가변 객체) — 뷰 전환·배속 변경에도 위치가 연속된다.
  // 앵커는 **서버 시각**이라 첫 렌더가 서버와 동일하고(하이드레이션 안전) 위상도 서버와 맞는다.
  const [clock] = useState(() => createOrbitClock(gameSpeed, snapshot.serverTime));

  const speed = gameSpeed * VIEW_STEPS[viewIdx];
  const showGlobe = layout === "stack" || view === "globe";
  const showTrack = layout === "stack" || view === "track";

  return (
    <div>
      {showGlobe && (
        <OrbitalCanvas
          snapshot={snapshot}
          speed={speed}
          clock={clock}
          myJoopId={myJoopId}
          myColor={myColor}
        />
      )}

      {showTrack && (
        <div className={showGlobe ? "mt-2" : undefined}>
          <OrbitTrackMap
            snapshot={snapshot}
            myJoopId={myJoopId}
            myColor={myColor}
            speed={speed}
            clock={clock}
            lang={lang}
            dict={dict}
            shadowFraction={shadowFraction}
            // 스택(우주 지도)에서는 LinkStatus·OrbitStatus 가 지표를 담당한다
            showIndicators={layout !== "stack"}
          />
        </div>
      )}

      {/* 관측 배속 + (toggle 레이아웃에서만) 뷰 전환 */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div
          className="flex overflow-hidden rounded-md border"
          style={{ borderColor: "var(--color-neutral-600)" }}
          role="group"
          aria-label={dict.firstScreen.speed}
        >
          {VIEW_STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setViewIdx(i)}
              aria-pressed={i === viewIdx}
              className="px-2 py-1 font-mono text-[10px]"
              style={
                i === viewIdx
                  ? { background: "var(--color-primary)", color: "var(--color-bg)" }
                  : { color: "var(--color-muted)" }
              }
            >
              {s}×
            </button>
          ))}
        </div>
        {layout === "toggle" && (
          <button
            onClick={() => setView(view === "globe" ? "track" : "globe")}
            className="rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest"
            style={{ borderColor: "var(--color-neutral-600)", color: "var(--color-fg)" }}
          >
            {view === "globe" ? dict.firstScreen.viewTrack : dict.firstScreen.viewGlobe} ⇄
          </button>
        )}
      </div>

      {reducedMotion && (
        <p className="mt-1.5 text-center font-mono text-[10px] text-[var(--color-muted)]">
          {dict.firstScreen.reducedMotion}
        </p>
      )}
    </div>
  );
}

/** 스냅샷 폴링 — 첫 화면과 우주 지도가 같은 주기로 갱신되도록 훅으로 공용화. */
export function useOrbitalSnapshot(initial: OrbitalSnapshot): OrbitalSnapshot {
  const [snapshot, setSnapshot] = useState(initial);
  useEffect(() => {
    const interval = Math.max(2, initial.tickSeconds || 10) * 1000;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/orbital", { cache: "no-store" });
        if (res.ok) setSnapshot((await res.json()) as OrbitalSnapshot);
      } catch {
        // 폴링 실패는 조용히 무시(다음 주기 재시도)
      }
    }, interval);
    return () => clearInterval(id);
  }, [initial.tickSeconds]);
  return snapshot;
}
