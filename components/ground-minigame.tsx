"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { applyThrust, DEFAULT_CONFIG, type MinigameConfig } from "@/lib/minigame";
import { submitMinigameResult } from "@/app/[lang]/joop/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

type Phase = "playing" | "over" | "saving" | "saved";

// 지상 미니게임: 관성(마찰0) 조작으로 우주 쓰레기를 먹는다.
// 화면을 누른 방향으로 분사(추력), 놓으면 관성 유지. 연료 소진 시 종료.
export function GroundMinigame({
  lang,
  dict,
  color,
}: {
  lang: Locale;
  dict: Dictionary;
  color: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("playing");
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<{ xpGained: number; level: number } | null>(null);
  const finalScoreRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cfg: MinigameConfig = DEFAULT_CONFIG;
    const styles = getComputedStyle(document.documentElement);
    const gridColor = styles.getPropertyValue("--color-grid").trim() || "#1e5a46";
    const amber = styles.getPropertyValue("--color-secondary").trim() || "#ffb23e";
    const fgColor = styles.getPropertyValue("--color-fg").trim() || "#e4f2e9";

    let raf = 0;
    let running = true;

    // 월드(픽셀) — devicePixelRatio 대응
    let W = 0;
    let H = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // 스케일 상수(화면 크기 비례)
    const unit = () => Math.min(W, H);
    const player = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 0 };
    player.r = unit() * 0.035;
    const speedScale = () => unit() * 0.012; // maxSpeed → px/frame

    type D = { x: number; y: number; vx: number; vy: number; r: number };
    const debris: D[] = [];
    const spawn = (): D => {
      const r = unit() * (0.018 + Math.random() * 0.02);
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * unit() * 0.002,
        vy: (Math.random() - 0.5) * unit() * 0.002,
        r,
      };
    };
    for (let i = 0; i < 7; i++) debris.push(spawn());

    let fuel = cfg.fuel;
    let localScore = 0;

    // 입력 — 포인터 위치(누르는 동안 그 방향으로 추력)
    let pointer: { x: number; y: number } | null = null;
    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      pointer = toLocal(e);
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (pointer) pointer = toLocal(e);
    };
    const onUp = () => {
      pointer = null;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const endGame = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      finalScoreRef.current = localScore;
      setScore(localScore);
      setPhase("over");
    };

    const draw = () => {
      const u = unit();
      // 물리
      let dir: { x: number; y: number } | null = null;
      let strength = 0;
      if (pointer && fuel > 0) {
        const dx = pointer.x - player.x;
        const dy = pointer.y - player.y;
        const d = Math.hypot(dx, dy);
        if (d > 1) {
          dir = { x: dx / d, y: dy / d };
          strength = Math.min(1, d / (u * 0.4));
          fuel = Math.max(0, fuel - 0.55 * strength);
        }
      }
      const maxPx = cfg.maxSpeed * speedScale();
      const v = applyThrust(
        { x: player.vx, y: player.vy },
        dir,
        strength,
        { ...cfg, thrust: cfg.thrust * speedScale(), maxSpeed: maxPx },
        fuel,
      );
      player.vx = v.x;
      player.vy = v.y;
      player.x += player.vx;
      player.y += player.vy;
      // 경계 반사
      if (player.x < player.r) {
        player.x = player.r;
        player.vx = -player.vx * 0.6;
      } else if (player.x > W - player.r) {
        player.x = W - player.r;
        player.vx = -player.vx * 0.6;
      }
      if (player.y < player.r) {
        player.y = player.r;
        player.vy = -player.vy * 0.6;
      } else if (player.y > H - player.r) {
        player.y = H - player.r;
        player.vy = -player.vy * 0.6;
      }

      // 렌더
      ctx.clearRect(0, 0, W, H);
      // 배경 그리드
      ctx.strokeStyle = gridColor;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 1;
      const gs = u * 0.12;
      for (let gx = 0; gx < W; gx += gs) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H);
        ctx.stroke();
      }
      for (let gy = 0; gy < H; gy += gs) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 쓰레기
      for (const d of debris) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > W) d.vx = -d.vx;
        if (d.y < 0 || d.y > H) d.vy = -d.vy;
        // 충돌
        if (Math.hypot(d.x - player.x, d.y - player.y) < d.r + player.r) {
          localScore++;
          setScore(localScore);
          Object.assign(d, spawn());
          continue;
        }
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = amber;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // 플레이어(줍스)
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      // 분사 방향 인디케이터
      if (pointer && fuel > 0) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, u * 0.05, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // HUD
      ctx.fillStyle = fgColor;
      ctx.font = `${Math.round(u * 0.04)}px ui-monospace, monospace`;
      ctx.textBaseline = "top";
      ctx.fillText(`${dict.minigame.score}: ${localScore}`, 12, 12);
      // 연료 바
      const barW = W - 24;
      ctx.fillStyle = gridColor;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(12, H - 20, barW, 8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = fuel > 25 ? color : amber;
      ctx.fillRect(12, H - 20, barW * (fuel / cfg.fuel), 8);

      if (fuel <= 0 && Math.hypot(player.vx, player.vy) < 0.2) {
        endGame();
        return;
      }
      if (running) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [color, dict.minigame.score]);

  const saveResult = async () => {
    setPhase("saving");
    const res = await submitMinigameResult(finalScoreRef.current);
    if (res.ok) {
      setResult({ xpGained: res.xpGained, level: res.level });
      setPhase("saved");
    } else {
      setPhase("over");
    }
  };

  return (
    <div className="relative flex flex-1 flex-col">
      <p className="px-4 pb-2 text-center font-mono text-xs text-[var(--color-muted)]">
        {dict.minigame.hint}
      </p>
      <div className="relative mx-4 flex-1 overflow-hidden rounded-md border" style={{ borderColor: "var(--color-neutral-600)" }}>
        <canvas ref={canvasRef} className="block h-full w-full touch-none" />

        {(phase === "over" || phase === "saving" || phase === "saved") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)] px-6 text-center">
            <h2 className="font-mono text-lg font-semibold text-[var(--color-primary)]">
              {dict.minigame.gameOver}
            </h2>
            <p className="font-mono text-sm text-[var(--color-fg)]">
              {dict.minigame.collected}: {score}
            </p>
            {phase === "saved" && result ? (
              <>
                <p className="font-mono text-sm text-[var(--color-primary)]">
                  +{result.xpGained} XP · {dict.minigame.nowLevel} {result.level}
                </p>
                <button
                  onClick={() => router.push(`/${lang}/joop`)}
                  className="rounded-md px-6 py-2.5 font-mono text-sm font-semibold uppercase tracking-widest"
                  style={{ background: "var(--color-primary)", color: "var(--color-bg)" }}
                >
                  {dict.minigame.toDashboard}
                </button>
              </>
            ) : (
              <button
                onClick={saveResult}
                disabled={phase === "saving"}
                className="rounded-md px-6 py-2.5 font-mono text-sm font-semibold uppercase tracking-widest disabled:opacity-60"
                style={{ background: "var(--color-primary)", color: "var(--color-bg)" }}
              >
                {phase === "saving" ? dict.minigame.saving : dict.minigame.save}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
