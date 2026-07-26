"use client";

import { useEffect, useRef } from "react";
import { positionAt, project2D } from "@/lib/orbit";
import type { OrbitalSnapshot } from "@/lib/joops";

// 지구 + 궤도 줍스 100개를 Canvas 2D로 렌더 (docs/architecture/adr/0003-rendering-canvas2d.md).
// 좌표는 lib/orbit 의 순수 함수로 매 프레임 계산(보간). 서버 스냅샷은 줍스 파라미터·집계만 제공.
export function OrbitalCanvas({ snapshot }: { snapshot: OrbitalSnapshot }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // rAF 콜백이 항상 최신 스냅샷을 참조하도록 ref 로 보관
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const styles = getComputedStyle(document.documentElement);
    const gridColor = styles.getPropertyValue("--color-grid").trim() || "#1e5a46";
    const earthColor = styles.getPropertyValue("--color-surface").trim() || "#0a1c10";

    let raf = 0;
    let running = true;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const snap = snapshotRef.current;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = 1.5; // 최대 궤도 반경 여유
      const scale = ((Math.min(w, h) / 2) * 0.92) / maxR;

      ctx.clearRect(0, 0, w, h);

      // 지구 + 경위도 그리드
      ctx.fillStyle = earthColor;
      ctx.beginPath();
      ctx.arc(cx, cy, scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = gridColor;
      ctx.globalAlpha = 0.55;
      ctx.stroke();
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, scale, scale * (k / 4), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, cy, scale * (k / 4), scale, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 줍스 (Unix 초 기준, t0=0 → 스냅샷 갱신과 무관하게 위상 연속)
      const t = Date.now() / 1000;
      for (const j of snap.joops) {
        const pos = positionAt(j.orbit, t, 0);
        const pt = project2D(pos);
        const sx = cx + pt.x * scale;
        const sy = cy - pt.y * scale;
        const front = pos.z >= 0;
        const behindEarth = !front && Math.hypot(pt.x, pt.y) < 1;
        if (behindEarth) continue; // 지구 뒤로 가려짐

        ctx.beginPath();
        ctx.arc(sx, sy, front ? 2.4 : 1.6, 0, Math.PI * 2);
        ctx.fillStyle = j.color;
        ctx.globalAlpha = front ? 1 : 0.45;
        ctx.shadowColor = j.color;
        ctx.shadowBlur = front ? 6 : 0;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      if (running && !reduceMotion) raf = requestAnimationFrame(draw);
    };

    draw(); // reduceMotion 이면 1회 정지 렌더

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduceMotion) {
        running = true;
        draw();
      } else {
        draw();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="block w-full aspect-square" />;
}
