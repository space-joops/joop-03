"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  readSoundSnapshot,
  setSoundOn,
  soundOnFrom,
  subscribeSoundStore,
  syncSoundFromStorage,
} from "../core/sound-prefs";
import { installAutoUnlock, unlockAudio } from "../core/sound";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dictionary = any;

// 게임 화면 음소거 토글. 에셋 0(인라인 SVG 스피커), 상태는 localStorage.
//
// 이 버튼의 **클릭 자체가 오디오 언락 제스처**를 겸한다 — 발사 화면처럼 자체 제스처가
// 없는 화면에서도 여기만 누르면 소리가 난다(언락 3중 방어의 2선).
//
// ⚠️ iOS 물리 무음 스위치는 WebAudio 로 우회할 수 없다. 토글이 켜져 있는데도
//    소리가 없다면 기기 무음 스위치를 확인해야 한다(워크로그에 명시).
export function SoundToggle({ dict, className = "" }: { dict: Dictionary; className?: string }) {
  const raw = useSyncExternalStore(subscribeSoundStore, readSoundSnapshot, () => "");
  const on = soundOnFrom(raw);

  // 저장값 → 엔진 반영은 반드시 렌더 밖에서(설정 없음 + reduced-motion 이면 꺼짐 기본).
  useEffect(() => {
    syncSoundFromStorage();
    installAutoUnlock();
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        unlockAudio(); // 이 클릭이 언락 제스처
        setSoundOn(!on);
      }}
      aria-pressed={on}
      aria-label={on ? dict.common.soundOn : dict.common.soundOff}
      title={on ? dict.common.soundOn : dict.common.soundOff}
      className={`flex h-8 w-8 items-center justify-center ${className}`}
      style={{ color: on ? "var(--color-primary)" : "var(--color-muted)" }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {on ? (
          <>
            <path d="M16 9.2a4 4 0 0 1 0 5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M18.6 6.6a7.6 7.6 0 0 1 0 10.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </>
        ) : (
          <path d="M16.2 9.6l5 4.8M21.2 9.6l-5 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
