// 기지국(세계 주요 도시) 선택 설정 — localStorage 한 칸. sound-prefs.ts 의 관용구를 따른다
// (useSyncExternalStore + 원시 문자열 스냅샷 → 렌더 중 setState 금지 규칙 회피).
//
// 지금은 선택값을 저장만 한다 — 음영 지역 계산(lib/orbit.ts, lib/space.ts)과의 연동은
// 차후 작업이다(설정 화면에 안내 문구로 명시).

import type { City } from "@/lib/cities";
import { cities } from "@/lib/cities";

const STORAGE_KEY = "joop03.baseStation.v1";
const EVENT = "joop03:baseStation";

function read(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** 스냅샷(원시 문자열, 도시 id) — useSyncExternalStore 용. SSR 은 "" 를 쓸 것. */
export function readBaseStationSnapshot(): string {
  return read();
}

export function subscribeBaseStationStore(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** 스냅샷(도시 id) → City(순수). 없거나 목록에 없으면 null. */
export function baseStationFrom(raw: string): City | null {
  if (!raw) return null;
  return cities.find((c) => c.id === raw) ?? null;
}

export function setBaseStation(city: City | null): void {
  if (typeof window === "undefined") return;
  try {
    if (city) {
      window.localStorage.setItem(STORAGE_KEY, city.id);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* 프라이빗 모드 — 이번 세션에만 적용된다 */
  }
  window.dispatchEvent(new Event(EVENT));
}
