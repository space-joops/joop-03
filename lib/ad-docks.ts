// 도킹한 광고 위성 기록 — localStorage(joop03.adDocks.v1). debris-kinds 관용구
// (원시 문자열 스냅샷 + useSyncExternalStore) + sound-prefs 변형(같은 탭 즉시 반영
// 커스텀 이벤트 — 도킹 직후 인벤토리·토스트가 재마운트 없이 갱신돼야 한다).
//
// 초대코드는 **서버(claimAdDockReward)가 실제 DB(joop_03_invite_codes)에 발급**한
// 값을 저장만 한다 — 클라이언트는 코드를 만들지 않는다.
// TODO(광고 관리자): 도킹 기록 자체를 DB 로 올릴 때 이 스토어는 캐시로 강등.

export type AdDockRecord = {
  v: 1;
  brandId: string;
  /** 서버가 발급한 실제 초대코드(JOOP-<LABEL>-NN) */
  code: string;
  /** epoch ms */
  dockedAt: number;
};

const STORAGE_KEY = "joop03.adDocks.v1";
const EVENT = "joop03:adDocks";

/** 저장 원문 → 레코드 배열(순수). 손상·구버전은 빈 배열. */
export function parseAdDocks(raw: string): AdDockRecord[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as AdDockRecord[];
    if (!Array.isArray(arr)) return [];
    return arr.filter((r) => r && r.v === 1 && typeof r.brandId === "string" && typeof r.code === "string");
  } catch {
    return [];
  }
}

/** 스냅샷(원시 문자열) — useSyncExternalStore 용. SSR 은 "" 를 쓸 것. */
export function readAdDockSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function subscribeAdDocks(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function getAdDock(brandId: string): AdDockRecord | null {
  return parseAdDocks(readAdDockSnapshot()).find((r) => r.brandId === brandId) ?? null;
}

/**
 * 도킹 기록 저장 — 브랜드당 1개 보장(이미 있으면 기존 레코드 반환, isNew=false).
 * 저장 후 커스텀 이벤트로 같은 탭 구독자에게 즉시 알린다.
 */
export function recordAdDock(brandId: string, code: string): { record: AdDockRecord; isNew: boolean } {
  const list = parseAdDocks(readAdDockSnapshot());
  const existing = list.find((r) => r.brandId === brandId);
  if (existing) return { record: existing, isNew: false };
  const record: AdDockRecord = { v: 1, brandId, code, dockedAt: Date.now() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...list, record]));
  } catch {
    // 프라이빗 모드 — 이번 세션 표시용으로만 쓰인다(코드 자체는 DB 에 있음)
  }
  window.dispatchEvent(new Event(EVENT));
  return { record, isNew: true };
}
