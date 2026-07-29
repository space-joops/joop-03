// 발사 다시 보기 기록 — localStorage 전용(마이그레이션 없음).
//
// 지구 복귀(returnToEarth)가 confirmed booking 을 삭제하므로 발사체 정보는
// DB 에서 소급 복원이 불가능하다 — 발사 성공 시점에 이 기기에 기록해 둔다.
// 관용구는 lib/debris-kinds.ts 와 동일(가드 + useSyncExternalStore 어댑터).

import type { MyVehicle } from "@/lib/launch";

export type LaunchReplayRecord = {
  v: 1;
  /** 발사 시각 ISO 문자열 */
  at: string;
  vehicle: MyVehicle | null;
  /** 줍스 색(로켓 폴백·궤도 링 연출용) */
  color: string;
  /** 당시 시퀀스 총 길이(초) */
  durationSeconds: number;
};

const STORAGE_KEY = "joop03.lastLaunch.v1";

export function recordLaunch(rec: Omit<LaunchReplayRecord, "v">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, ...rec }));
  } catch {
    // 프라이빗 모드 등 — 리플레이만 못 하게 될 뿐, 조용히 무시
  }
}

/** 저장 원문에서 기록 파싱 — 렌더 중 호출해도 순수. 손상/부재 시 null. */
export function parseReplayRecord(raw: string): LaunchReplayRecord | null {
  if (!raw) return null;
  try {
    const rec = JSON.parse(raw) as LaunchReplayRecord;
    return rec && rec.v === 1 ? rec : null;
  } catch {
    return null;
  }
}

// ── useSyncExternalStore 어댑터 (스냅샷 = 원문 문자열 — 원시값이라 참조 안정) ──

export function readReplaySnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function subscribeReplayStore(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
