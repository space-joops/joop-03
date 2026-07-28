"use client";

import { useEffect, useState } from "react";
import { SplashMark } from "@/components/splash-mark";

// 인앱 스플래시 — 매 방문(전체 로드)마다 표시하는 브랜드 부팅 화면.
// iOS 네이티브 스플래시(appleWebApp.startupImage)는 설치형 + 해상도 일치 기기에서만
// 뜨므로, 브라우저를 포함한 모든 진입에서 보이도록 앱 레벨로 한 장 더 둔다.
// - SSR 부터 보이게 초기 상태가 "표시" — 앱 화면이 먼저 번쩍이지 않는다.
// - 최소 노출 시간(SPLASH_MS) 뒤 자동으로 페이드아웃, 스킵 버튼으로 즉시 닫기 가능.
// - SPA 내비게이션에는 다시 뜨지 않는다(레이아웃이 유지되므로) — 새로고침/재진입 기준 "매번".
const SPLASH_MS = 2800;
const FADE_MS = 300;

export function SplashScreen({ appName, skipLabel }: { appName: string; skipLabel: string }) {
  const [stage, setStage] = useState<"shown" | "leaving" | "gone">("shown");

  useEffect(() => {
    if (stage === "shown") {
      const t = window.setTimeout(() => setStage("leaving"), SPLASH_MS);
      return () => clearTimeout(t);
    }
    if (stage === "leaving") {
      const t = window.setTimeout(() => setStage("gone"), FADE_MS);
      return () => clearTimeout(t);
    }
  }, [stage]);

  if (stage === "gone") return null;

  return (
    <div
      role="status"
      aria-label={appName}
      className={`splash-screen${stage === "leaving" ? " splash-leaving" : ""}`}
    >
      {/* 디자이너 원본 스플래시(네이티브 PNG 와 동일 배치) + 궤도·세그먼트 애니메이션.
          궤도 점이 한 바퀴 도는 데 걸리는 시간이 SPLASH_MS 와 같아 진행 신호 역할을 한다. */}
      <SplashMark />

      <button
        type="button"
        onClick={() => setStage("leaving")}
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] underline"
      >
        {skipLabel} ▸
      </button>
    </div>
  );
}
