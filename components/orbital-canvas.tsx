"use client";

import { useEffect, useRef } from "react";
import { positionAt, project2D } from "@/lib/orbit";
import { starHash } from "@/lib/arcade";
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
    const amberColor = styles.getPropertyValue("--color-secondary").trim() || "#ffb23e";
    const accentColor = styles.getPropertyValue("--color-accent").trim() || "#38e0f0";
    const fgColor = styles.getPropertyValue("--color-fg").trim() || "#e4f2e9";
    const mutedColor = styles.getPropertyValue("--color-muted").trim() || "#8a9e92";

    let raf = 0;
    let running = true;

    // 실사 지구(아케이드와 같은 bg-earth.webp) — 와이어프레임 "안"에 깔린다(UX 리뷰:
    // "오염된 지구가 와닿지 않는다"). 2048² 원본을 매 프레임 그리면 비싸므로 resize 때
    // 표시 크기로 1회 축소해 오프스크린에 캐시한다. 미로드 시 기존 단색 폴백.
    const earthImg = new Image();
    earthImg.src = "/game/bg-earth.webp";
    let earthCache: HTMLCanvasElement | null = null;
    let earthCacheSize = 0;
    const buildEarthCache = () => {
      if (!earthImg.complete || earthImg.naturalWidth === 0) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const maxR = 1.5;
      const scale = ((Math.min(rect.width, rect.height) / 2) * 0.92) / maxR;
      const px = Math.max(2, Math.round(2 * scale * dpr));
      if (px === earthCacheSize && earthCache) return;
      const off = document.createElement("canvas");
      off.width = px;
      off.height = px;
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.drawImage(earthImg, 0, 0, px, px);
      earthCache = off;
      earthCacheSize = px;
    };
    earthImg.onload = () => {
      buildEarthCache();
      if (reduceMotion) draw(); // 정지 렌더는 로드 후 1회 다시 그린다
    };

    // 궤도 쓰레기 입자 링(UX 리뷰: 오염 시각화) — 궤도대(반경 1.05~1.43)에 결정적으로
    // 뿌린다. starHash 시드 고정이라 프레임마다 반짝이지 않고, 개별 각속도로 천천히 돈다.
    const DEBRIS_DOT_COLORS = [amberColor, accentColor, fgColor, mutedColor];
    const debrisDots = Array.from({ length: 110 }, (_, i) => ({
      a: starHash(i, 1, 0) * Math.PI * 2,
      r: 1.05 + starHash(i, 2, 1) * 0.38,
      size: 1 + starHash(i, 3, 2),
      w: (starHash(i, 4, 3) - 0.5) * 0.06,
      alpha: 0.5 + starHash(i, 5, 4) * 0.4,
      color: DEBRIS_DOT_COLORS[Math.min(3, (starHash(i, 6, 5) * 4) | 0)],
    }));

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildEarthCache();
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

      // 지구 + 경위도 그리드 — 실사 이미지가 있으면 원 안에 클립해 깔고,
      // 와이어프레임 그리드는 그 위에 얹는다(홀로그램 오버레이 느낌).
      ctx.fillStyle = earthColor;
      ctx.beginPath();
      ctx.arc(cx, cy, scale, 0, Math.PI * 2);
      ctx.fill();
      const hasEarth = !!earthCache;
      if (earthCache) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, scale, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(earthCache, cx - scale, cy - scale, scale * 2, scale * 2);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, scale, 0, Math.PI * 2);
      ctx.strokeStyle = gridColor;
      ctx.globalAlpha = hasEarth ? 0.35 : 0.55;
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

      // 궤도 쓰레기 입자 링 — 줍스 점 아래 레이어. 반경이 항상 지구(1.0) 밖이라
      // 앞/뒤 컬링이 필요 없다. fillRect(1~2px) + shadowBlur 없음 = 저비용.
      for (const d of debrisDots) {
        const ang = d.a + t * d.w;
        const px = cx + Math.cos(ang) * d.r * scale;
        const py = cy - Math.sin(ang) * d.r * scale * 0.62; // 살짝 눌러 궤도면 느낌
        ctx.globalAlpha = d.alpha * 0.75;
        ctx.fillStyle = d.color;
        ctx.fillRect(px, py, d.size, d.size);
      }
      ctx.globalAlpha = 1;

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
