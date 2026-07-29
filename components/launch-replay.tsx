"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { LaunchSequence } from "@/components/launch-sequence";
import { parseReplayRecord, readReplaySnapshot, subscribeReplayStore } from "@/lib/launch-replay";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

// 발사 다시 보기(FR-5.3 착수) — localStorage 기록을 읽어 LaunchSequence 를
// replay 모드로 재생한다. SSR 스냅샷은 "" → 첫 렌더는 "기록 없음"과 동일 마크업이라
// 하이드레이션 안전(debris-kinds 관용구).
export function LaunchReplay({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const raw = useSyncExternalStore(subscribeReplayStore, readReplaySnapshot, () => "");
  const rec = parseReplayRecord(raw);

  if (!rec) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-mono text-sm leading-relaxed text-[var(--color-muted)]">
          {dict.launch.noReplay}
        </p>
        <Link
          href={`/${lang}/joop`}
          className="font-mono text-xs text-[var(--color-fg)] underline"
        >
          {dict.joop.back}
        </Link>
      </div>
    );
  }

  return (
    <LaunchSequence
      lang={lang}
      dict={dict}
      color={rec.color}
      countdownSeconds={3}
      sequenceSeconds={rec.durationSeconds}
      vehicle={rec.vehicle}
      mode="replay"
    />
  );
}
