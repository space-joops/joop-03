"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completeLaunch } from "@/app/[lang]/joop/launch/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { trackLaunchCompleted } from "@/lib/analytics";

type Phase = "countdown" | "ascent" | "saving" | "done";

// 발사 시퀀스: 카운트다운 → Canvas 발사 애니메이션 → completeLaunch → 우주 지도.
export function LaunchSequence({
  lang,
  dict,
  color,
  countdownSeconds,
}: {
  lang: Locale;
  dict: Dictionary;
  color: string;
  countdownSeconds: number;
}) {
  const t = dict.launch;
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("countdown");
  const [count, setCount] = useState(countdownSeconds);
  const [stage, setStage] = useState<string>("");

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

      // 로켓 위치(하단 → 상단 위로)
      const rx = W / 2;
      const ry = H * 0.82 - progress * H * 1.05;
      const rw = Math.min(W, H) * 0.05;
      const rh = rw * 2.4;

      // 화염(상승 중)
      if (progress < 0.92) {
        ctx.beginPath();
        ctx.moveTo(rx - rw * 0.5, ry + rh * 0.5);
        ctx.lineTo(rx + rw * 0.5, ry + rh * 0.5);
        ctx.lineTo(rx, ry + rh * 0.5 + rh * (0.6 + Math.random() * 0.5));
        ctx.closePath();
        ctx.fillStyle = amber;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // 단분리(중반 이후 떨어지는 조각)
      if (progress > 0.5) {
        const sepY = ry + rh * 0.6 + (progress - 0.5) * H * 0.8;
        ctx.fillStyle = muted;
        ctx.fillRect(rx - rw * 0.3, sepY, rw * 0.6, rw * 0.4);
      }

      // 로켓 본체(줍스 색)
      ctx.beginPath();
      ctx.roundRect(rx - rw * 0.5, ry - rh * 0.5, rw, rh, rw * 0.3);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.fill();
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
      <div className="relative mx-4 flex-1 overflow-hidden rounded-md border" style={{ borderColor: "var(--color-neutral-600)", background: "var(--color-bg)" }}>
        <canvas ref={canvasRef} className="block h-full w-full" />

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
          <div className="absolute inset-x-0 top-4 text-center">
            <span className="font-mono text-sm uppercase tracking-widest text-[var(--color-primary)]">
              {stage}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
