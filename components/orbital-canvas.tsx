"use client";

import { useEffect, useRef } from "react";
import { positionAt, project2D } from "@/lib/orbit";
import { tickOrbitClock, type OrbitClock } from "@/lib/orbit-clock";
import { JOOP_FRAME, joopSheetPath, sheetForColor, spriteFrame } from "@/lib/joop-sprite";
import type { OrbitalSnapshot } from "@/lib/joops";

// 지구 + 궤도 줍스 100개를 Canvas 2D로 렌더 (docs/architecture/adr/0003-rendering-canvas2d.md).
// 좌표는 lib/orbit 의 순수 함수로 매 프레임 계산(보간). 서버 스냅샷은 줍스 파라미터·집계만 제공.
//
// speed/clock: 표시 배속(가상 시계, lib/orbit-clock.ts). 실제 각속도는 1바퀴 64~131분이라
// 그대로는 정지로 보인다 — 물리값(ω)을 건드리면 우주 지도 계기까지 오염되므로 표시만 가속한다.
export function OrbitalCanvas({
  snapshot,
  speed = 1,
  clock,
  myJoopId = null,
  myColor = null,
}: {
  snapshot: OrbitalSnapshot;
  /** 표시 배속(1 = 실속도). 렌더 중에도 바꿀 수 있다. */
  speed?: number;
  /** 뷰 간 공유하는 가상 시계. 없으면 실시간(배속 무시). */
  clock?: OrbitClock;
  /** 강조할 내 줍스 — 점 대신 애니메이션 스프라이트 + 궤도 링으로 그린다 */
  myJoopId?: string | null;
  myColor?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // rAF 콜백이 항상 최신 스냅샷/배속을 참조하도록 ref 로 보관
  const snapshotRef = useRef(snapshot);
  const speedRef = useRef(speed);
  const clockRef = useRef(clock);
  const myIdRef = useRef(myJoopId);
  const sheetRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    clockRef.current = clock;
  }, [clock]);
  useEffect(() => {
    myIdRef.current = myJoopId;
  }, [myJoopId]);

  // 내 줍스 스프라이트 시트(색상 변형) 선로딩 — 없으면 점으로 폴백한다.
  useEffect(() => {
    if (!myJoopId || !myColor) {
      sheetRef.current = null;
      return;
    }
    const img = new Image();
    img.src = joopSheetPath(sheetForColor(myColor));
    sheetRef.current = img;
  }, [myJoopId, myColor]);

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
      // reduced-motion 은 rAF 루프가 없어 resize 로 지워진 캔버스를 다시 그려야 한다
      if (reduceMotion) {
        cancelAnimationFrame(raf);
        draw();
      }
    };

    const draw = () => {
      const snap = snapshotRef.current;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      // 레이아웃 확정 전(크기 0)이면 다음 프레임 재시도 — reduced-motion 단발 렌더 포함
      if (w < 2 || h < 2) {
        if (running) raf = requestAnimationFrame(draw);
        return;
      }
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

      // 줍스 — 가상 시계(배속) 기준. t0=0 이라 스냅샷 갱신과 무관하게 위상 연속.
      const clk = clockRef.current;
      const t = clk ? tickOrbitClock(clk, speedRef.current) : Date.now() / 1000;
      const myId = myIdRef.current;
      const mine = myId ? snap.joops.find((j) => j.id === myId) : undefined;

      // 내 궤도 링 — 한 주기를 64등분해 폴리라인으로(예전 space-map 패턴 이식)
      if (mine) {
        ctx.strokeStyle = mine.color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const period = (2 * Math.PI) / (Math.abs(mine.orbit.angularVelocity) || 1e-9);
        for (let a = 0; a <= 64; a++) {
          const p = project2D(positionAt(mine.orbit, t + (a / 64) * period, 0));
          const px = cx + p.x * scale;
          const py = cy - p.y * scale;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const j of snap.joops) {
        const pos = positionAt(j.orbit, t, 0);
        const pt = project2D(pos);
        const sx = cx + pt.x * scale;
        const sy = cy - pt.y * scale;
        const front = pos.z >= 0;
        const behindEarth = !front && Math.hypot(pt.x, pt.y) < 1;
        if (behindEarth) continue; // 지구 뒤로 가려짐
        if (mine && j.id === mine.id) continue; // 내 줍스는 마지막에 스프라이트로

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

      // 내 줍스 — 애니메이션 스프라이트 + 조준링으로 한눈에 식별되게
      if (mine) {
        const pos = positionAt(mine.orbit, t, 0);
        const pt = project2D(pos);
        const sx = cx + pt.x * scale;
        const sy = cy - pt.y * scale;
        const front = pos.z >= 0;
        const size = Math.max(22, Math.min(w, h) * 0.11);
        const sheet = sheetRef.current;

        ctx.globalAlpha = front ? 1 : 0.55;
        if (sheet && sheet.complete && sheet.naturalWidth > 0) {
          // 궤도에서는 늘 움직이는 중이라 move 상태(reduced-motion 이면 첫 프레임 고정).
          // ⚠️ 프레임 진행은 **실시간**으로 센다 — 게임 배속이 곱해진 t 를 쓰면
          //    8fps 애니메이션이 배속만큼 빨라져 깜빡임으로 보인다.
          const frame = spriteFrame("move", performance.now() / 1000, reduceMotion);
          ctx.drawImage(
            sheet,
            frame * JOOP_FRAME,
            0,
            JOOP_FRAME,
            JOOP_FRAME,
            sx - size / 2,
            sy - size / 2,
            size,
            size,
          );
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, 4, 0, Math.PI * 2);
          ctx.fillStyle = mine.color;
          ctx.fill();
        }
        // 조준링
        ctx.strokeStyle = mine.color;
        ctx.globalAlpha = front ? 0.75 : 0.4;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, size * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (running && !reduceMotion) raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    draw(); // reduceMotion 이면 1회 정지 렌더(크기 0이면 자체 재시도)

    const onVisibility = () => {
      // visible 이벤트가 연속으로 와도 루프가 중복 생기지 않게 항상 기존 프레임을 취소
      cancelAnimationFrame(raf);
      if (document.hidden) {
        running = false;
      } else {
        running = true;
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

  return <canvas ref={canvasRef} className="block w-full aspect-[7/5]" />;
}
