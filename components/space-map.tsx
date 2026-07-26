"use client";

import { useEffect, useRef } from "react";
import { positionAt, project2D } from "@/lib/orbit";
import type { OrbitState } from "@/lib/space";

// 내 줍스 중심 우주 지도: 지구 + 궤도 링 + 내 줍스(움직임). M1 orbital-canvas 패턴 재사용.
export function SpaceMap({ state }: { state: OrbitState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const styles = getComputedStyle(document.documentElement);
    const gridColor = styles.getPropertyValue("--color-grid").trim() || "#1e5a46";
    const earthColor = styles.getPropertyValue("--color-surface").trim() || "#0f1826";

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
      const st = stateRef.current;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w < 2 || h < 2) {
        if (running) raf = requestAnimationFrame(draw);
        return;
      }
      const cx = w / 2;
      const cy = h / 2;
      const scale = ((Math.min(w, h) / 2) * 0.9) / 1.4;

      ctx.clearRect(0, 0, w, h);

      // 지구
      ctx.fillStyle = earthColor;
      ctx.beginPath();
      ctx.arc(cx, cy, scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = gridColor;
      ctx.globalAlpha = 0.55;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, scale, scale * (k / 4), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, cy, scale * (k / 4), scale, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 내 궤도 링(현재 시각 주변 샘플로 타원 근사)
      ctx.strokeStyle = st.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const t0 = Date.now() / 1000;
      for (let a = 0; a <= 64; a++) {
        const tt = t0 + (a / 64) * (2 * Math.PI) / st.orbit.angularVelocity;
        const p = project2D(positionAt(st.orbit, tt, 0));
        const px = cx + p.x * scale;
        const py = cy - p.y * scale;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 내 줍스 현재 위치
      const t = Date.now() / 1000;
      const pos = positionAt(st.orbit, t, 0);
      const pt = project2D(pos);
      const sx = cx + pt.x * scale;
      const sy = cy - pt.y * scale;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = st.color;
      ctx.shadowColor = st.color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      // 조준 링
      ctx.strokeStyle = st.color;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(sx, sy, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (running && !reduce) raf = requestAnimationFrame(draw);
    };
    draw();

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce) {
        running = true;
        draw();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={canvasRef} className="block aspect-square w-full" />;
}
