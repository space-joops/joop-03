"use client";

import { useEffect, useState } from "react";

// 단말기 상단 장식 상태바 — 이슈 #5 CRT 컨셉 (앰버 위계).
// G.S.T.(Ground Station Time) 시계 + 신호/배터리 글리프. 순수 장식이라 aria-hidden,
// 문구도 i18n 하지 않는다. 마운트 전에는 플레이스홀더를 렌더해 hydration 불일치를 피한다.
export function StatusBar() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-GB", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      aria-hidden
      className="flex items-center justify-between px-4 py-1.5 font-mono text-[10px] tracking-widest text-[var(--color-secondary)]"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 0.375rem)",
        borderBottom: "1px solid color-mix(in srgb, var(--color-secondary) 45%, transparent)",
      }}
    >
      <span>▚▚▚</span>
      <span>{time ?? "--:--:--"} G.S.T.</span>
      <span>▮▮▮▯</span>
    </div>
  );
}
