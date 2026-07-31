// 사운드 켜기/끄기 설정 — localStorage 한 칸. debris-kinds.ts 의 관용구를 따른다
// (useSyncExternalStore + 원시 문자열 스냅샷 → 렌더 중 setState 금지 규칙 회피).
//
// 차이점: 토글은 **같은 탭에서 즉시** 반영돼야 하므로 커스텀 이벤트를 하나 쓴다
// (storage 이벤트는 타 탭 변경만 온다).
//
// 하이드레이션: SSR 스냅샷은 "" 이고 "" 는 "켜짐"으로 읽힌다(기본값 = 켜짐).
// 저장값이 "off" 인 사용자는 첫 페인트에서 잠깐 켜짐 아이콘을 보게 되지만,
// **소리는 sound.ts 의 setMuted 가 통제**하므로 실제로 울리지는 않는다.

import { setMuted } from "./sound";

const STORAGE_KEY = "joop03.sound.v1";
const EVENT = "joop03:sound";

function read(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** 스냅샷(원시 문자열) — useSyncExternalStore 용. SSR 은 "" 를 쓸 것. */
export function readSoundSnapshot(): string {
  return read();
}

export function subscribeSoundStore(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** 스냅샷 → 켜짐 여부(순수). 저장값이 없으면 켜짐. */
export function soundOnFrom(raw: string): boolean {
  return raw !== "off";
}

export function setSoundOn(on: boolean): void {
  setMuted(!on);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* 프라이빗 모드 — 이번 세션에만 적용된다 */
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * 저장값을 엔진에 1회 반영 — **렌더 밖**(effect/이벤트 핸들러)에서만 호출한다.
 * 저장값이 없을 때 reduced-motion 사용자는 기본 꺼짐으로 시작한다(모션·소리 자극 최소화).
 */
export function syncSoundFromStorage(): void {
  if (typeof window === "undefined") return;
  const raw = read();
  if (raw) {
    setMuted(raw === "off");
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) setSoundOn(false);
}
