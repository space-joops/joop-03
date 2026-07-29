"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeLaunch } from "@/app/[lang]/joop/launch/actions";
import type { MyVehicle } from "@/lib/launch";
import {
  buildLaunchTimeline,
  resolveVehicleProfile,
  sampleTelemetry,
  type LaunchEventId,
} from "@/lib/vehicle-profiles";
import { recordLaunch } from "@/lib/launch-replay";
import { TelemetryBar, launchEventLabel } from "@/components/telemetry-bar";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { trackLaunchCompleted } from "@/lib/analytics";

type Phase = "countdown" | "ascent" | "saving" | "done";

// 발사체 벡터(디자인 handoff-m4): 64×160, anchor 하단 중앙 [32,152](노즐 끝).
const ROCKET_SRC = "/game/rocket.svg";
const ROCKET_RATIO = 64 / 160; // w/h
const ROCKET_NOZZLE = 152 / 160; // 이미지 상단 기준 노즐 y 비율

/** 로켓을 노즐 기준점(nx, ny)에 높이 h 로 그린다. 이미지가 없으면 폴백 막대. */
function drawRocket(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  nx: number,
  ny: number,
  h: number,
  fallbackColor: string,
) {
  if (img && img.complete && img.naturalWidth > 0) {
    const w = h * ROCKET_RATIO;
    ctx.drawImage(img, nx - w / 2, ny - h * ROCKET_NOZZLE, w, h);
  } else {
    const w = h * 0.28;
    ctx.beginPath();
    ctx.roundRect(nx - w / 2, ny - h * 0.95, w, h * 0.9, w * 0.3);
    ctx.fillStyle = fallbackColor;
    ctx.fill();
  }
}

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

// 발사 시퀀스 — SpaceX 중계풍(FR-5.2): 카운트다운 → 다단계 상승 중계(2~2.5분, 배속
// 1×/4×/16×) → completeLaunch → 우주 지도. 단계·텔레메트리는 발사체 프로필
// (lib/vehicle-profiles.ts)이 만든 타임라인을 따른다.
// mode="replay": 발사 기록 재생 전용 — 서버 액션·기록 저장 없이 done 오버레이로 끝난다.
export function LaunchSequence({
  lang,
  dict,
  color,
  countdownSeconds,
  sequenceSeconds = 150,
  vehicle = null,
  mode = "live",
}: {
  lang: Locale;
  dict: Dictionary;
  color: string;
  countdownSeconds: number;
  /** 중계 총 길이(초) — config launch_sequence_seconds */
  sequenceSeconds?: number;
  /** 내가 청약해 확정된 발사체 — 미션 행 + 프로필 해석용(null 이면 기본 프로필) */
  vehicle?: MyVehicle | null;
  mode?: "live" | "replay";
}) {
  const t = dict.launch;
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rocketRef = useRef<HTMLImageElement | null>(null);
  const [phase, setPhase] = useState<Phase>("countdown");
  const [count, setCount] = useState(mode === "replay" ? 3 : countdownSeconds);
  const [stageId, setStageId] = useState<LaunchEventId | null>(null);
  const [passedCount, setPassedCount] = useState(0);
  const [telemetry, setTelemetry] = useState({ speedKmh: 0, altKm: 0, tPlus: 0 });
  // 배속: 버튼 UI 는 state, rAF 는 ref — state 를 effect deps 에 넣으면 루프가
  // 재시작되므로(진행 리셋) 반드시 ref 로만 읽는다.
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const speedRef = useRef(1);
  const onPlaybackSpeed = (s: number) => {
    speedRef.current = s;
    setPlaybackSpeed(s);
  };

  const profile = useMemo(() => resolveVehicleProfile(vehicle), [vehicle]);
  const timeline = useMemo(
    () => buildLaunchTimeline(profile, sequenceSeconds),
    [profile, sequenceSeconds],
  );
  // completeLaunch 를 사출(deploy) 시점에 조기 호출해 두고, 끝나면 결과만 기다린다.
  const launchPromiseRef = useRef<Promise<{ ok: boolean }> | null>(null);

  // 로켓 에셋 선로딩 — 실패해도 폴백 막대로 진행한다.
  useEffect(() => {
    const img = new Image();
    img.src = ROCKET_SRC;
    rocketRef.current = img;
  }, []);

  // 카운트다운 발사대 장면 — 정적 1회 렌더(+리사이즈 재렌더). 로켓 ×2.2 로 크게.
  useEffect(() => {
    if (phase !== "countdown") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const muted = styles.getPropertyValue("--color-muted").trim() || "#8a9e92";
    const grid = styles.getPropertyValue("--color-grid").trim() || "#1e5a46";

    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      if (W < 2 || H < 2) {
        raf = requestAnimationFrame(draw);
        return;
      }
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // 별
      ctx.fillStyle = muted;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 60; i++) {
        ctx.beginPath();
        ctx.arc((((i * 97) % 100) / 100) * W, (((i * 53) % 100) / 100) * H * 0.8, (i % 3) * 0.4 + 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 발사대 지면 + 타워
      const padY = H * 0.86;
      ctx.strokeStyle = grid;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, padY);
      ctx.lineTo(W, padY);
      ctx.stroke();
      const rocketH = Math.min(W, H) * 0.14 * 2.2; // 발사대 ×2.2
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = grid;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(W / 2 + rocketH * ROCKET_RATIO * 0.9, padY);
      ctx.lineTo(W / 2 + rocketH * ROCKET_RATIO * 0.9, padY - rocketH * 1.05);
      ctx.stroke();
      ctx.globalAlpha = 1;

      drawRocket(ctx, rocketRef.current, W / 2, padY, rocketH, profile.bodyColor);
    };
    draw();
    const img = rocketRef.current;
    if (img && !img.complete) img.addEventListener("load", draw, { once: true });
    window.addEventListener("resize", draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", draw);
      img?.removeEventListener("load", draw);
    };
  }, [phase, profile.bodyColor]);

  // 카운트다운(1초 타이머) — reduced-motion 은 즉시 상승.
  useEffect(() => {
    if (phase !== "countdown") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setInterval(
      () => {
        setCount((c) => {
          if (reduce || c <= 1) {
            clearInterval(id);
            setPhase("ascent");
            return 0;
          }
          return c - 1;
        });
      },
      reduce ? 0 : 1000,
    );
    return () => clearInterval(id);
  }, [phase]);

  // ── 상승 중계(단일 rAF) — 가상 경과시간 vElapsed 에 배속(ref)을 곱해 누적한다.
  useEffect(() => {
    if (phase !== "ascent") return;
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) {
      setPhase(mode === "replay" ? "done" : "saving");
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setPhase(mode === "replay" ? "done" : "saving");
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = timeline[timeline.length - 1].tSec;

    const styles = getComputedStyle(document.documentElement);
    const amber = styles.getPropertyValue("--color-secondary").trim() || "#ffb23e";
    const muted = styles.getPropertyValue("--color-muted").trim() || "#8a9e92";
    const grid = styles.getPropertyValue("--color-grid").trim() || "#1e5a46";
    const surface = styles.getPropertyValue("--color-surface").trim() || "#0a1c10";

    // 2분+ 시퀀스 — 회전/주소창 수축에 대응해 컨테이너 크기를 추적한다.
    let W = 0;
    let H = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = box.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(box);

    const stars = Array.from({ length: 70 }, (_, i) => ({
      x: ((i * 97) % 100) / 100,
      y: ((i * 53) % 100) / 100,
      r: (i % 3) * 0.4 + 0.3,
    }));

    // 이벤트 시각 헬퍼
    const at = (id: LaunchEventId) => timeline.find((e) => e.id === id)?.tSec ?? -1;
    const tMaxQ = at("maxQ");
    const tMeco = at("meco");
    const tSep = at("separation");
    const tSecond = at("secondIgnition");
    const tBL = at("boosterLanding"); // 없으면 -1
    const tSeco = at("seco");
    const tDeploy = at("deploy");

    let raf = 0;
    let running = true;
    let vElapsed = 0;
    let lastTs = performance.now();
    let stageIdx = 0;
    let launched = false; // completeLaunch 조기 호출 1회 가드
    let lastShownSec = -1;
    let lastShownSpeed = -1;

    const finish = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      setPhase(mode === "replay" ? "done" : "saving");
    };

    const draw = (ts: number) => {
      const dt = Math.min(0.1, (ts - lastTs) / 1000);
      lastTs = ts;
      vElapsed = reduce ? total : Math.min(total, vElapsed + dt * speedRef.current);
      if (W < 2 || H < 2) {
        if (running) raf = requestAnimationFrame(draw);
        return;
      }

      // 단계 전진 — 16× 에서 한 프레임에 이벤트를 2개 지날 수 있어 while 로 전진.
      while (stageIdx < timeline.length && timeline[stageIdx].tSec <= vElapsed) {
        const ev = timeline[stageIdx];
        stageIdx += 1;
        setPassedCount(stageIdx);
        setStageId(ev.id);
        // 사출 시점에 궤도 진입을 미리 저장(서버 멱등) — 끝나면 결과만 기다린다.
        if (ev.id === "deploy" && mode === "live" && !launched) {
          launched = true;
          launchPromiseRef.current = completeLaunch().catch(() => ({ ok: false }));
        }
      }

      // 텔레메트리 — 표시값이 바뀔 때만 setState(초당 ~10회 상한)
      const tel = sampleTelemetry(timeline, vElapsed);
      const shownSec = Math.floor(vElapsed);
      const shownSpeed = Math.round(tel.speedKmh / 10) * 10;
      if (shownSec !== lastShownSec || shownSpeed !== lastShownSpeed) {
        lastShownSec = shownSec;
        lastShownSpeed = shownSpeed;
        setTelemetry({ speedKmh: shownSpeed, altKm: tel.altKm, tPlus: vElapsed });
      }

      // ── 장면 ──────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);
      const altNorm = smooth(tel.altKm / 210);

      // 별 — 고도가 오를수록 아래로 흐른다(상승감)
      ctx.fillStyle = muted;
      const drift = (vElapsed * (6 + altNorm * 26)) / H;
      for (const s of stars) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(s.x * W, ((s.y + drift) % 1.05) * H, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 부스터 착륙 컷어웨이(프로필 해당 시, tBL±4초) — 별도 장면으로 전환
      const inCutaway = tBL >= 0 && vElapsed >= tBL - 4 && vElapsed <= tBL + 4;
      if (inCutaway) {
        const ct = (vElapsed - (tBL - 4)) / 8; // 0→1
        const shipY = H * 0.82;
        // 드론십
        ctx.strokeStyle = grid;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(W * 0.3, shipY);
        ctx.lineTo(W * 0.7, shipY);
        ctx.stroke();
        ctx.fillStyle = surface;
        ctx.fillRect(W * 0.3, shipY, W * 0.4, 5);
        // 하강하는 부스터(그리드 핀 + 착륙 연소)
        const bh = Math.min(W, H) * 0.14 * 1.2 * profile.stageRatio;
        const by = H * 0.12 + smooth(ct) * (shipY - H * 0.12);
        const landed = by >= shipY - 1;
        ctx.save();
        ctx.fillStyle = profile.bodyColor;
        ctx.fillRect(W / 2 - bh * ROCKET_RATIO * 0.32, by - bh, bh * ROCKET_RATIO * 0.64, bh);
        // 착륙 다리(마지막 20%)
        if (ct > 0.75) {
          ctx.strokeStyle = profile.accentColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(W / 2 - bh * ROCKET_RATIO * 0.3, by);
          ctx.lineTo(W / 2 - bh * ROCKET_RATIO * 0.7, by + bh * 0.12);
          ctx.moveTo(W / 2 + bh * ROCKET_RATIO * 0.3, by);
          ctx.lineTo(W / 2 + bh * ROCKET_RATIO * 0.7, by + bh * 0.12);
          ctx.stroke();
        }
        // 착륙 연소(착지 전)
        if (!landed && ct > 0.25) {
          const fl = bh * (0.5 + (reduce ? 0 : Math.random() * 0.2));
          ctx.beginPath();
          ctx.moveTo(W / 2 - bh * ROCKET_RATIO * 0.2, by);
          ctx.lineTo(W / 2 + bh * ROCKET_RATIO * 0.2, by);
          ctx.lineTo(W / 2, by + fl);
          ctx.closePath();
          ctx.fillStyle = amber;
          ctx.globalAlpha = 0.9;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      } else {
        // 메인 장면 — 상승/항행/사출
        const liftT = smooth(vElapsed / Math.max(1, tMaxQ)); // 초반 이륙 카메라
        const rh0 = Math.min(W, H) * 0.14 * 1.6;
        const separated = vElapsed >= tSep;
        const rh = separated ? rh0 * (1 - profile.stageRatio * 0.45) : rh0;
        const rx = W / 2 + (vElapsed >= tMaxQ - 3 && vElapsed <= tMaxQ + 3 && !reduce ? (Math.random() - 0.5) * 4 : 0); // Max-Q 진동
        // 초반: 발사대에서 화면 중앙까지 상승, 이후 중앙 고정(배경이 흐름)
        const ny = H * 0.88 - liftT * H * 0.33;

        // 발사대(이륙 직후까지 아래로 스크롤 아웃)
        if (vElapsed < tMaxQ) {
          const padY = H * 0.86 + liftT * H * 0.5;
          ctx.strokeStyle = grid;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, padY);
          ctx.lineTo(W, padY);
          ctx.stroke();
        }

        // 지구 림(SECO 이후 하단에 차오르는 곡선 — 궤도 도달감)
        if (vElapsed > tSeco) {
          const k = smooth((vElapsed - tSeco) / Math.max(1, total - tSeco));
          ctx.fillStyle = surface;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.ellipse(W / 2, H + H * (0.9 - 0.35 * k), W * 1.2, H * 0.5, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#9fd4ff";
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // 분리된 1단(분리~+8초 낙하)
        if (separated && vElapsed < tSep + 8) {
          const st = (vElapsed - tSep) / 8;
          const sh = rh0 * profile.stageRatio * 0.8;
          const sy = ny + rh * 0.15 + st * H * 0.9;
          ctx.globalAlpha = 1 - st * 0.5;
          ctx.fillStyle = profile.bodyColor;
          ctx.fillRect(rx - sh * ROCKET_RATIO * 0.3, sy, sh * ROCKET_RATIO * 0.6, sh * 0.5);
          ctx.globalAlpha = 1;
        }

        // 화염 — MECO 전(1단) / 2단 점화~SECO(작고 밝은 코어)
        const burning =
          vElapsed < tMeco || (vElapsed >= tSecond && vElapsed < tSeco);
        if (burning) {
          const second = vElapsed >= tSecond;
          const rw = rh * ROCKET_RATIO;
          const flameLen = rh * (second ? 0.3 : 0.45) * (reduce ? 1 : 0.9 + Math.random() * 0.2);
          ctx.beginPath();
          ctx.moveTo(rx - rw * (second ? 0.16 : 0.28), ny);
          ctx.lineTo(rx + rw * (second ? 0.16 : 0.28), ny);
          ctx.lineTo(rx, ny + flameLen);
          ctx.closePath();
          ctx.fillStyle = second ? "#cfe8ff" : amber;
          ctx.globalAlpha = 0.9;
          ctx.fill();
          if (!second) {
            ctx.beginPath();
            ctx.moveTo(rx - rw * 0.14, ny);
            ctx.lineTo(rx + rw * 0.14, ny);
            ctx.lineTo(rx, ny + flameLen * 0.55);
            ctx.closePath();
            ctx.fillStyle = "#f2f7f0";
            ctx.globalAlpha = 0.85;
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        // 로켓 본체
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        drawRocket(ctx, rocketRef.current, rx, ny, rh, profile.bodyColor);
        ctx.shadowBlur = 0;

        // 줍스 사출(디플로이 이후) — 색 점 + 링이 위로 떠오른다
        if (vElapsed >= tDeploy) {
          const dpT = smooth((vElapsed - tDeploy) / Math.max(1, total - tDeploy));
          const jx = rx + dpT * W * 0.22;
          const jy = ny - rh * 0.9 - dpT * H * 0.18;
          ctx.beginPath();
          ctx.arc(jx, jy, 5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(jx, jy, 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // 궤도 호(막바지)
        if (vElapsed > tDeploy) {
          const k = (vElapsed - tDeploy) / Math.max(1, total - tDeploy);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.7 * smooth(k);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(W / 2, H * 0.3, W * 0.42, H * 0.16, 0, Math.PI, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      if (vElapsed >= total) {
        finish();
        return;
      }
      if (running) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // 백그라운드 탭: 일시정지(중계 연출) — 복귀 시 lastTs 재설정으로 점프 방지
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && running) {
        lastTs = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase, color, mode, timeline, profile]);

  // 저장·이동 — deploy 에서 조기 호출한 결과를 기다렸다가 한 번만 이동.
  useEffect(() => {
    if (phase !== "saving") return;
    let navigated = false;
    const go = (path: string) => {
      if (navigated) return;
      navigated = true;
      router.push(path);
    };
    const promise = launchPromiseRef.current ?? completeLaunch().catch(() => ({ ok: false }));
    promise
      .then((res) => {
        if (res.ok) {
          trackLaunchCompleted();
          // 다시 보기 기록(localStorage) — 지구 복귀 시 booking 이 지워져 DB 복원 불가
          recordLaunch({
            at: new Date().toISOString(),
            vehicle,
            color,
            durationSeconds: sequenceSeconds,
          });
        }
        go(res.ok ? `/${lang}/joop/map` : `/${lang}/joop`);
      })
      .catch(() => go(`/${lang}/joop/map`));
    const fallback = setTimeout(() => go(`/${lang}/joop/map`), 6000);
    return () => clearTimeout(fallback);
  }, [phase, lang, router, vehicle, color, sequenceSeconds]);

  const stageLabel = stageId ? launchEventLabel(t, stageId) : "";

  return (
    <div className="relative flex flex-1 flex-col">
      <div ref={boxRef} className="relative flex-1 overflow-hidden" style={{ background: "var(--color-bg)" }}>
        {/* absolute + inset-0 — 흐름 배치 + h-full 은 canvas 고유 종횡비가 이겨
            화면 위쪽 ~150px 만 쓰게 된다(지상 훈련·아케이드에서 이미 확인된 함정) */}
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

        {/* 미션 행 — 내가 청약한 발사체(핸드오프 m4 §3) */}
        {vehicle && (
          <div className="absolute inset-x-0 top-3 flex flex-col items-center gap-0.5">
            <span
              className="font-mono text-base font-semibold tracking-wide text-[var(--color-fg)]"
              style={{ textShadow: "var(--glow-primary)" }}
            >
              {vehicle.name}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
              {vehicle.provider} · {vehicle.site}
            </span>
          </div>
        )}

        {phase === "countdown" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
              {t.countdownLabel}
            </span>
            <span
              className="font-mono text-6xl font-bold tabular-nums"
              style={{ color: "var(--color-primary)", textShadow: "var(--glow-primary)" }}
            >
              {Math.max(0, count)}
            </span>
          </div>
        )}

        {(phase === "ascent" || phase === "saving") && stageLabel && (
          <div className={`absolute inset-x-0 ${vehicle ? "top-14" : "top-4"} text-center`}>
            <span className="font-mono text-sm uppercase tracking-widest text-[var(--color-primary)]">
              {stageLabel}
            </span>
          </div>
        )}

        {/* 리플레이 종료 오버레이 */}
        {phase === "done" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[color-mix(in_srgb,var(--color-bg)_80%,transparent)] px-6 text-center">
            <span className="font-mono text-lg font-semibold text-[var(--color-primary)]">
              {t.replayTitle}
            </span>
            <button
              onClick={() => {
                setPassedCount(0);
                setStageId(null);
                setTelemetry({ speedKmh: 0, altKm: 0, tPlus: 0 });
                setCount(3);
                setPhase("countdown");
              }}
              className="crt-brackets btn-brackets max-w-xs"
              style={{ "--bracket-color": "var(--color-primary)", color: "var(--color-primary)" } as React.CSSProperties}
            >
              {t.replayAgain}
            </button>
            <Link
              href={`/${lang}/joop`}
              className="font-mono text-xs text-[var(--color-muted)] underline"
            >
              {dict.joop.back}
            </Link>
          </div>
        )}
      </div>

      {/* SpaceX 중계풍 하단 텔레메트리 바 — 카운트다운 중엔 T-·게이지 0 */}
      <TelemetryBar
        tPlusSec={telemetry.tPlus}
        countdown={phase === "countdown" ? count : null}
        speedKmh={telemetry.speedKmh}
        altitudeKm={telemetry.altKm}
        events={timeline}
        passedCount={passedCount}
        currentLabel={stageLabel}
        playbackSpeed={playbackSpeed}
        onPlaybackSpeed={onPlaybackSpeed}
        dict={dict}
      />
    </div>
  );
}
