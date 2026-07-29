"use client";

import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { LaunchEvent, LaunchEventId } from "@/lib/vehicle-profiles";

// SpaceX 중계 스타일 하단 텔레메트리 바(발사 화면 전용, DOM).
//   [이벤트 타임라인 점 행 — 지나간 것 채움, 현재 라벨만 텍스트]
//   [SPEED 게이지 | T+MM:SS 대형 + 배속 | ALTITUDE 게이지]
// 아케이드는 값이 rAF 클로저에 있어 캔버스 인그림으로 따로 그린다(시각 스펙만 공유).
// 부모(launch-sequence)가 표시값이 바뀔 때만 setState 하므로 리렌더는 초당 ~10회.

const SPEED_MAX_KMH = 28000;
const ALT_MAX_KM = 250;
export const PLAYBACK_SPEEDS = [1, 4, 16] as const;

/** 이벤트 id → 번역 라벨(타입 안전 매핑) */
export function launchEventLabel(l: Dictionary["launch"], id: LaunchEventId): string {
  switch (id) {
    case "liftoff":
      return l.liftoff;
    case "maxQ":
      return l.maxQ;
    case "meco":
      return l.meco;
    case "separation":
      return l.separation;
    case "secondIgnition":
      return l.secondIgnition;
    case "boosterLanding":
      return l.boosterLanding;
    case "seco":
      return l.seco;
    case "fairing":
      return l.fairing;
    case "deploy":
      return l.deploy;
    case "orbitInsertion":
      return l.orbitInsertion;
  }
}

function Gauge({
  value,
  max,
  label,
  display,
  unit,
}: {
  value: number;
  max: number;
  label: string;
  display: string;
  unit: string;
}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, value / max));
  return (
    <div className="flex flex-col items-center" aria-label={`${label} ${display} ${unit}`}>
      <div className="relative h-[64px] w-[64px]">
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-grid)" strokeOpacity="0.45" strokeWidth="4" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="var(--color-fg)"
            strokeWidth="4"
            strokeDasharray={`${c * frac} ${c}`}
            transform="rotate(-90 32 32)"
            strokeLinecap="butt"
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-mono text-sm font-semibold text-[var(--color-fg)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {display}
        </span>
      </div>
      <span className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted)]">
        {label} <span className="normal-case">{unit}</span>
      </span>
    </div>
  );
}

export function TelemetryBar({
  tPlusSec,
  countdown = null,
  speedKmh,
  altitudeKm,
  events,
  passedCount,
  currentLabel,
  playbackSpeed,
  onPlaybackSpeed,
  dict,
}: {
  /** T+ 경과 초(가상 시계). countdown 이 있으면 무시하고 T- 표시 */
  tPlusSec: number;
  /** 카운트다운 남은 초 — 있으면 T- 모드(게이지 0) */
  countdown?: number | null;
  speedKmh: number;
  altitudeKm: number;
  events: LaunchEvent[];
  /** 지나간 이벤트 수(타임라인 점 채움) */
  passedCount: number;
  /** 현재 이벤트 라벨(번역된 문자열) */
  currentLabel: string;
  playbackSpeed: number;
  onPlaybackSpeed: (s: number) => void;
  dict: Dictionary;
}) {
  const l = dict.launch;
  const t = countdown != null ? Math.max(0, countdown) : Math.max(0, Math.floor(tPlusSec));
  const mm = String(Math.floor(t / 60)).padStart(2, "0");
  const ss = String(t % 60).padStart(2, "0");
  const labelFor = (id: LaunchEventId) => launchEventLabel(l, id);

  return (
    <div
      className="w-full border-t px-3 pt-1.5"
      style={{
        borderColor: "var(--color-grid)",
        background: "color-mix(in srgb, var(--color-bg) 82%, transparent)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)",
      }}
    >
      {/* 이벤트 타임라인 — 점 + 지나감 채움, 라벨은 현재 이벤트만(SpaceX 방식) */}
      <div className="flex items-center justify-center gap-1.5" aria-hidden>
        {events.map((e, i) => (
          <span key={e.id} className="flex items-center gap-1.5">
            {i > 0 && (
              <span
                className="h-px w-4"
                style={{ background: i < passedCount ? "var(--color-fg)" : "var(--color-grid)" }}
              />
            )}
            <span
              className="h-1.5 w-1.5 rounded-full"
              title={labelFor(e.id)}
              style={{
                background: i < passedCount ? "var(--color-fg)" : "transparent",
                border: `1px solid ${i < passedCount ? "var(--color-fg)" : "var(--color-muted)"}`,
              }}
            />
          </span>
        ))}
      </div>
      <p className="mt-0.5 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--color-primary)]">
        {countdown != null ? l.countdownLabel : currentLabel}
      </p>

      <div className="mt-1 flex items-center justify-between">
        <Gauge
          value={countdown != null ? 0 : speedKmh}
          max={SPEED_MAX_KMH}
          label={l.speedLabel}
          display={countdown != null ? "0" : speedKmh.toLocaleString()}
          unit="km/h"
        />

        <div className="flex flex-col items-center">
          <span
            className="font-mono text-3xl font-semibold text-[var(--color-fg)]"
            style={{ fontVariantNumeric: "tabular-nums", textShadow: "var(--glow-primary)" }}
          >
            {countdown != null ? "T-" : "T+"}
            {mm}:{ss}
          </span>
          {/* 배속 — 긴 중계를 원하는 속도로 (사용자 결정: 1×/4×/16×) */}
          <div
            className="mt-1 flex overflow-hidden rounded-md border"
            style={{ borderColor: "var(--color-neutral-600)" }}
            role="group"
            aria-label={l.playbackSpeed}
          >
            {PLAYBACK_SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => onPlaybackSpeed(s)}
                aria-pressed={s === playbackSpeed}
                className="px-2 py-0.5 font-mono text-[10px]"
                style={
                  s === playbackSpeed
                    ? { background: "var(--color-primary)", color: "var(--color-bg)" }
                    : { color: "var(--color-muted)" }
                }
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <Gauge
          value={countdown != null ? 0 : altitudeKm}
          max={ALT_MAX_KM}
          label={l.altitudeLabel}
          display={countdown != null ? "0" : String(Math.round(altitudeKm))}
          unit="km"
        />
      </div>
    </div>
  );
}
