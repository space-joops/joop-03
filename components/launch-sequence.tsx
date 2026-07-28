"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completeLaunch } from "@/app/[lang]/joop/launch/actions";
import type { MyVehicle } from "@/lib/launch";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { trackLaunchCompleted } from "@/lib/analytics";

type Phase = "countdown" | "ascent" | "saving" | "done";

// 발사체 벡터(디자인 handoff-m4): 64×160, anchor 하단 중앙 [32,152](노즐 끝).
// 사용 배율 — 카운트다운(발사대) ×2.2 · 중계(비행) ×1.6 은 기본 높이 대비 배수로 반영.
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

// 발사 시퀀스: 카운트다운(발사대 장면) → Canvas 발사 애니메이션 → completeLaunch → 우주 지도.
export function LaunchSequence({
  lang,
  dict,
  color,
  countdownSeconds,
  vehicle = null,
}: {
  lang: Locale;
  dict: Dictionary;
  color: string;
  countdownSeconds: number;
  /** 내가 청약해 확정된 발사체 — 미션 행 표시용(null 이면 생략) */
  vehicle?: MyVehicle | null;
}) {
  const t = dict.launch;
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rocketRef = useRef<HTMLImageElement | null>(null);
  const [phase, setPhase] = useState<Phase>("countdown");
  const [count, setCount] = useState(countdownSeconds);
  const [stage, setStage] = useState<string>("");

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

      drawRocket(ctx, rocketRef.current, W / 2, padY, rocketH, color);
    };
    draw();
    // 에셋이 늦게 로드되면 다시 그린다
    const img = rocketRef.current;
    if (img && !img.complete) img.addEventListener("load", draw, { once: true });
    window.addEventListener("resize", draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", draw);
      img?.removeEventListener("load", draw);
    };
  }, [phase, color]);

  // 카운트다운(1초 타이머) — reduced-motion 은 즉시 상승.
  // setState 는 setInterval 콜백 안에서만(effect 본문 직접 호출 회피).
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

  // 발사 애니메이션(Canvas rAF) — 진행률은 내부 변수, setState 는 단계 라벨/완료만
  useEffect(() => {
    if (phase !== "ascent") return;
    const canvas = canvasRef.current;
    if (!canvas) {
      setPhase("saving");
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setPhase("saving");
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 별 배경(고정)
    const stars = Array.from({ length: 60 }, (_, i) => ({
      x: ((i * 97) % 100) / 100,
      y: ((i * 53) % 100) / 100,
      r: (i % 3) * 0.4 + 0.3,
    }));

    let raf = 0;
    let lastStage = "";
    // 진행률은 프레임 수가 아니라 실제 경과 시간 기준 → 백그라운드 탭에서 rAF 가
    // throttle 돼도 활성화 시 정확히 따라잡는다.
    const startTs = performance.now();
    const DURATION = 2500; // 발사 애니메이션 길이(ms)
    const styles = getComputedStyle(document.documentElement);
    const amber = styles.getPropertyValue("--color-secondary").trim() || "#ffb23e";
    const muted = styles.getPropertyValue("--color-muted").trim() || "#8a9e92";

    const setStageOnce = (s: string) => {
      if (s !== lastStage) {
        lastStage = s;
        setStage(s);
      }
    };

    const draw = (ts: number) => {
      const progress = reduce ? 1 : Math.min(1, (ts - startTs) / DURATION);
      ctx.clearRect(0, 0, W, H);
      // 별
      ctx.fillStyle = muted;
      for (const s of stars) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 로켓 노즐 기준점(하단 → 상단 위로). 비행 배율 ×1.6 (handoff-m4).
      const rx = W / 2;
      const rh = Math.min(W, H) * 0.14 * 1.6;
      const ny = H * 0.88 - progress * (H + rh) * 1.05;
      const rw = rh * ROCKET_RATIO;

      // 화염(상승 중) — 노즐 아래 2겹(외곽 앰버 / 내부 밝은 코어), 길이 플리커
      if (progress < 0.92) {
        const flameLen = rh * (0.45 + Math.random() * 0.18);
        ctx.beginPath();
        ctx.moveTo(rx - rw * 0.28, ny);
        ctx.lineTo(rx + rw * 0.28, ny);
        ctx.lineTo(rx, ny + flameLen);
        ctx.closePath();
        ctx.fillStyle = amber;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(rx - rw * 0.14, ny);
        ctx.lineTo(rx + rw * 0.14, ny);
        ctx.lineTo(rx, ny + flameLen * 0.55);
        ctx.closePath();
        ctx.fillStyle = "#f2f7f0";
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // 단분리(중반 이후 떨어지는 조각)
      if (progress > 0.5) {
        const sepY = ny + rh * 0.1 + (progress - 0.5) * H * 0.8;
        ctx.fillStyle = muted;
        ctx.fillRect(rx - rw * 0.3, sepY, rw * 0.6, rw * 0.4);
      }

      // 로켓 본체 — 디자인 에셋(rocket.svg), 미로딩 시 폴백 막대
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      drawRocket(ctx, rocketRef.current, rx, ny, rh, color);
      ctx.shadowBlur = 0;

      // 궤도 호(막바지)
      if (progress > 0.85) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = (progress - 0.85) / 0.15;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(W / 2, H * 0.3, W * 0.42, H * 0.16, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 단계 라벨
      if (progress < 0.15) setStageOnce(t.ignition);
      else if (progress < 0.55) setStageOnce(t.ascent);
      else if (progress < 0.9) setStageOnce(t.separation);
      else setStageOnce(t.orbitInsertion);

      if (progress >= 1) {
        setPhase("saving");
        return;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // 하드 상한: rAF 가 아예 안 돌아도(탭 백그라운드 등) 결국 다음 단계로.
    const hardStop = setTimeout(() => setPhase("saving"), DURATION + 3000);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hardStop);
    };
  }, [phase, color, t.ignition, t.ascent, t.separation, t.orbitInsertion]);

  // 궤도 진입 저장 — 한 번만 이동하고, 액션이 지연/실패해도 반드시 화면을 넘긴다.
  useEffect(() => {
    if (phase !== "saving") return;
    let navigated = false;
    const go = (path: string) => {
      if (navigated) return;
      navigated = true;
      router.push(path);
    };
    completeLaunch()
      .then((res) => {
        if (res.ok) trackLaunchCompleted();
        go(res.ok ? `/${lang}/joop/map` : `/${lang}/joop`);
      })
      .catch(() => go(`/${lang}/joop/map`));
    // 안전장치: 액션이 응답하지 않아도 결국 우주 지도로(궤도 진입은 서버에서 처리됨).
    const fallback = setTimeout(() => go(`/${lang}/joop/map`), 6000);
    return () => clearTimeout(fallback);
  }, [phase, lang, router]);

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        className="relative mx-3 mb-1 flex-1 overflow-hidden rounded-md border"
        style={{ borderColor: "var(--color-neutral-600)", background: "var(--color-bg)" }}
      >
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

        {(phase === "ascent" || phase === "saving" || phase === "done") && stage && (
          <div className={`absolute inset-x-0 ${vehicle ? "top-14" : "top-4"} text-center`}>
            <span className="font-mono text-sm uppercase tracking-widest text-[var(--color-primary)]">
              {stage}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
