// 수거 쓰레기 "종류" 로컬 트래커 — UX 리뷰(랭킹 기여도 아이콘) 대응.
//
// DB 는 총 수거량만 기록한다(joop_03_debris_events.amount). 종류별 컬럼을 더하는
// 마이그레이션 대신 **로컬 스토리지에만** 저장하기로 결정(2026-07-28):
//   - 내 행: 이 기기에서 실제로 수거한 종류 누적(getMyTopKinds) — 실데이터.
//   - 타인 행: joopId 기반 결정적 장식(decorativeKindsFor) — 실데이터가 아니며
//     SSR/CSR 이 같은 결과를 내야 하이드레이션이 안전하다(순수 해시).
// 추후 DB 에 종류 컬럼이 생기면 DebrisKindIcons 의 데이터 소스만 바꾸면 된다.

import { ARCADE_DEBRIS } from "./arcade";

export type DebrisKindId = "can" | "bolt" | "nut" | "panel" | "strut" | "chip";

export const DEBRIS_KIND_IDS = ARCADE_DEBRIS.map((d) => d.id) as DebrisKindId[];

const STORAGE_KEY = "joop03.debrisKinds.v1";

function readCounts(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {}; // 프라이빗 모드 등 — 조용히 무시
  }
}

/** 한 판의 종류별 수거량을 누적 병합 저장. 게임 종료 시 1회 호출(프레임 비용 0). */
export function recordCollectedKinds(counts: Partial<Record<DebrisKindId, number>>): void {
  if (typeof window === "undefined") return;
  try {
    const acc = readCounts();
    for (const [k, n] of Object.entries(counts)) {
      if (!n) continue;
      acc[k] = (acc[k] ?? 0) + n;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(acc));
  } catch {
    // 저장 실패는 장식 데이터 손실일 뿐 — 무시
  }
}

/** 내가 가장 많이 수거한 종류 상위 n개. 기록이 없으면 빈 배열. */
export function getMyTopKinds(n = 3): DebrisKindId[] {
  return parseTopKinds(readKindStoreSnapshot(), n);
}

/** 저장 원문 → 종류별 전체 카운트(순수) — 인벤토리 그리드용. 미지 종류는 걸러낸다. */
export function parseKindCounts(raw: string): Partial<Record<DebrisKindId, number>> {
  if (!raw) return {};
  try {
    const acc = JSON.parse(raw) as Record<string, number>;
    const out: Partial<Record<DebrisKindId, number>> = {};
    for (const [k, n] of Object.entries(acc)) {
      if ((DEBRIS_KIND_IDS as string[]).includes(k) && typeof n === "number" && n > 0) {
        out[k as DebrisKindId] = n;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** 저장 원문(JSON 문자열)에서 상위 n개 종류를 파생 — 렌더 중 호출해도 순수. */
export function parseTopKinds(raw: string, n = 3): DebrisKindId[] {
  return (Object.entries(parseKindCounts(raw)) as [DebrisKindId, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

// ── useSyncExternalStore 어댑터 (react-hooks/set-state-in-effect 회피 관용구)
/** 스냅샷 = 저장 원문 문자열(원시값이라 참조 안정성 자동 충족). SSR 은 "" 를 쓸 것. */
export function readKindStoreSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function subscribeKindStore(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // storage 이벤트는 타 탭 변경만 온다 — 같은 탭 갱신(recordCollectedKinds)은
  // 화면 이동(재마운트) 시 새 스냅샷으로 반영되므로 충분하다.
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

// FNV-1a 류 문자열 해시 — 서버/클라 동일 결과(순수)라 하이드레이션 안전.
function hashStr(s: string, seed: number): number {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 타인 행용 결정적 장식 종류 n개(중복 없음) — 실데이터가 아니다(aria-hidden 권장). */
export function decorativeKindsFor(joopId: string, n = 3): DebrisKindId[] {
  const pool = [...DEBRIS_KIND_IDS];
  const out: DebrisKindId[] = [];
  for (let i = 0; i < Math.min(n, pool.length); i++) {
    const idx = hashStr(joopId, i * 7 + 1) % pool.length;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
