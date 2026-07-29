"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { parseReplayRecord, readReplaySnapshot, subscribeReplayStore } from "@/lib/launch-replay";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

// 대시보드 "발사 다시 보기" — 이 기기에 발사 기록이 있을 때만 렌더.
// SSR/첫 하이드레이션은 스냅샷 "" → null(마크업 일치, 안전).
export function ReplayLaunchButton({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const raw = useSyncExternalStore(subscribeReplayStore, readReplaySnapshot, () => "");
  if (!parseReplayRecord(raw)) return null;
  return (
    <Link
      href={`/${lang}/joop/launch/replay`}
      className="crt-brackets btn-brackets text-xs"
      style={{ "--bracket-color": "var(--color-neutral-600)", color: "var(--color-muted)" } as React.CSSProperties}
    >
      {dict.joop.replayLaunch}
    </Link>
  );
}
