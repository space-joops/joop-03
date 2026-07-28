"use client";

import { useSyncExternalStore } from "react";
import { DebrisIcon } from "@/components/debris-icon";
import {
  decorativeKindsFor,
  parseTopKinds,
  subscribeKindStore,
  readKindStoreSnapshot,
} from "@/lib/debris-kinds";

// 랭킹 행의 "수거 종류" 아이콘 묶음(UX 리뷰 기여도 표시).
// SSR/첫 하이드레이션은 결정적 장식(decorativeKindsFor) — 서버·클라 동일해 안전.
// 내 행(mine)은 로컬 스토리지 스냅샷(useSyncExternalStore)에서 실데이터를 파생한다.
// 타인 행은 실데이터가 아니므로 장식(aria-hidden)으로만 취급한다.
export function DebrisKindIcons({
  joopId,
  mine = false,
  count = 3,
  size = 14,
}: {
  joopId: string;
  mine?: boolean;
  count?: number;
  size?: number;
}) {
  const raw = useSyncExternalStore(subscribeKindStore, readKindStoreSnapshot, () => "");
  const real = mine ? parseTopKinds(raw, count) : [];
  const kinds = real.length > 0 ? real : decorativeKindsFor(joopId, count);

  return (
    <span aria-hidden className="inline-flex shrink-0 items-center gap-0.5 opacity-80">
      {kinds.map((k) => (
        <DebrisIcon key={k} kind={k} size={size} />
      ))}
    </span>
  );
}
