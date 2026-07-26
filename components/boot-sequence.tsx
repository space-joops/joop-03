"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { CartridgePanel } from "@/components/cartridge-panel";
import { SegmentBar } from "@/components/segment-bar";
import { JoopCharacter } from "@/components/joop-character";
import { PrimaryButton } from "@/components/console-button";

const SEGMENTS = 12; // 핸드오프 §3-5: 12칸 세그먼트 바
const BOOT_MS = 3000; //             3초에 걸쳐 채움
const LOG_STEP_MS = 800; //          로그 한 줄 0.8s 간격
const SEEN_KEY = "joops:boot-seen";

// 로그의 순서·OK 여부는 코드가 소유하고 문구만 사전에서 가져온다.
const LOG_LINES = [
  { key: "logOrbitProtocol", ok: true },
  { key: "logCollectModule", ok: true },
  { key: "logCitizenRegistry", ok: false },
] as const;

export function BootSequence({
  lang,
  dict,
  deviceName,
  /** 프리뷰/검수에서 연출을 건너뛰고 완료 상태를 보고 싶을 때 */
  startComplete = false,
  /** false 면 "이미 봤음" 기록을 남기지 않는다(검수 화면에서 매번 재생하도록) */
  rememberSeen = true,
}: {
  lang: Locale;
  dict: Dictionary;
  deviceName: string;
  startComplete?: boolean;
  rememberSeen?: boolean;
}) {
  const t = dict.onboarding.boot;
  const router = useRouter();
  const [filled, setFilled] = useState(startComplete ? SEGMENTS : 0);
  const [shownLogs, setShownLogs] = useState(startComplete ? LOG_LINES.length : 0);
  const [complete, setComplete] = useState(startComplete);

  useEffect(() => {
    if (startComplete) return;

    const finish = () => {
      setFilled(SEGMENTS);
      setShownLogs(LOG_LINES.length);
      setComplete(true);
    };

    // 이미 본 연출은 다시 재생하지 않는다(③에서 뒤로 왔을 때·브라우저 뒤로가기 포함).
    const seen = rememberSeen && sessionStorage.getItem(SEEN_KEY) === "1";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const markSeen = () => {
      if (rememberSeen) sessionStorage.setItem(SEEN_KEY, "1");
    };
    if (seen || reduceMotion) {
      // 모션 최소화: 바를 즉시 100%로, 로그는 일괄 표시(핸드오프 §3-5)
      finish();
      markSeen();
      return;
    }

    // 바와 로그를 같은 rAF 클럭에서 파생 → 두 타이머가 어긋나지 않고,
    // 탭이 숨겨졌다 돌아와도 경과 시간 기준으로 정확한 위치를 잡는다.
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      setFilled(Math.min(SEGMENTS, Math.floor((elapsed / BOOT_MS) * SEGMENTS)));
      setShownLogs(Math.min(LOG_LINES.length, Math.floor(elapsed / LOG_STEP_MS) + 1));
      if (elapsed >= BOOT_MS) {
        finish();
        markSeen();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startComplete, rememberSeen]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <CartridgePanel
          screen={<JoopCharacter size={170} label={dict.onboarding.a11y.bootingJoop} />}
        >
          <div className="mt-3 mb-2 flex items-baseline justify-between">
            <b
              className="font-display text-[20px] font-bold tracking-[0.02em] text-[var(--color-primary)]"
              style={{ textShadow: "var(--glow-text)" }}
            >
              {deviceName}
            </b>
            <span className="font-mono text-xs leading-4 text-[var(--color-muted)]" aria-live="polite">
              {complete ? t.ready : t.status}
            </span>
          </div>

          <SegmentBar segments={SEGMENTS} filled={filled} height={10} />

          <div className="mt-2.5 font-mono text-xs leading-[18px] text-[var(--color-muted)]">
            {LOG_LINES.slice(0, shownLogs).map((line) => (
              <p key={line.key}>
                &gt; {t[line.key]}
                {line.ok && <span className="text-[var(--color-success)]"> {t.logOk}</span>}
              </p>
            ))}
          </div>
        </CartridgePanel>

        <p className="text-[15px] leading-[22px] text-[var(--color-muted)]">{t.lead}</p>
      </div>

      <div className="mt-auto pt-3 pb-[calc(var(--safe-bottom)+12px)]">
        <PrimaryButton
          disabled={!complete}
          onClick={() => router.push(`/${lang}/onboarding/setup`)}
        >
          {t.cta}
        </PrimaryButton>
      </div>
    </div>
  );
}
