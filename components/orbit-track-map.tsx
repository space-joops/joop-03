"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  groundStateAt,
  shadowStateAt,
  EARTH_ROTATION_RAD_S,
  type GroundState,
} from "@/lib/orbit";
import { tickOrbitClock, type OrbitClock } from "@/lib/orbit-clock";
import { JOOP_FRAME, joopSheetPath, sheetForColor, spriteFrame } from "@/lib/joop-sprite";
import { WORLD_GRID_W, WORLD_GRID_H, isLandCell } from "@/lib/world-map-grid";
import { regionAt } from "@/lib/geo-regions";
import type { OrbitalSnapshot } from "@/lib/joops";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

const DEG = 180 / Math.PI;

// 궤도 추적 모니터 — 지구본을 equirectangular 로 펼친 위성 관제 화면.
// 지상 궤적(ground track) 계산은 lib/orbit.groundStateAt(서버와 공유하는 positionAt 기반),
// 배경 육지는 lib/world-map-grid(빌드 시 Natural Earth 에서 생성한 비트 그리드)를 쓴다.
// 지구 자전을 배속과 함께 돌리므로 실제 관제 화면처럼 궤적이 서쪽으로 흘러간다.
export function OrbitTrackMap({
  snapshot,
  myJoopId,
  myColor = null,
  speed,
  clock,
  lang,
  dict,
  showIndicators = true,
  shadowFraction = 0.5,
  mini = false,
}: {
  snapshot: OrbitalSnapshot;
  /** 강조할 내 줍스 id (궤도에 없으면 null → 첫 줍스를 관측 대상으로) */
  myJoopId: string | null;
  /** 내 줍스 색 — 스프라이트 시트 변형 선택에 쓴다 */
  myColor?: string | null;
  speed: number;
  clock: OrbitClock;
  lang: Locale;
  dict: Dictionary;
  /** 지표 패널 표시 여부 — 우주 지도는 OrbitStatus/LinkStatus 가 따로 있어 끈다(중복 방지) */
  showIndicators?: boolean;
  /** 교신 판정에 쓰는 음영 비율(config shadow_fraction). 서버 판정과 같은 값을 넘겨야 한다. */
  shadowFraction?: number;
  /** 축소·톤다운 보조 뷰(우주 지도 stack) — 지구본이 主, 추적 지도는 보조라는 위계.
   *  ⚠️ CSS transform(perspective 등)은 캔버스 rect·DPR 계산을 어긋내므로 쓰지 않는다. */
  mini?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snapshotRef = useRef(snapshot);
  const speedRef = useRef(speed);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // 관측 대상: 내 줍스가 궤도에 있으면 내 줍스, 아니면 스냅샷 첫 줍스(비로그인 방문자 폴백)
  const focus = useMemo(() => {
    return snapshot.joops.find((j) => j.id === myJoopId) ?? snapshot.joops[0] ?? null;
  }, [snapshot, myJoopId]);
  const focusRef = useRef(focus);
  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);

  // 관측 대상 스프라이트 시트 — 내 줍스일 때만 애니메이션으로 그린다(요구: 지도에서 식별).
  const sheetRef = useRef<HTMLImageElement | null>(null);
  const isMine = !!(focus && myJoopId && focus.id === myJoopId);
  useEffect(() => {
    if (!isMine) {
      sheetRef.current = null;
      return;
    }
    const img = new Image();
    img.src = joopSheetPath(sheetForColor(myColor ?? focus?.color ?? "#35e07a"));
    sheetRef.current = img;
  }, [isMine, myColor, focus?.color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const styles = getComputedStyle(document.documentElement);
    const gridColor = styles.getPropertyValue("--color-grid").trim() || "#1e5a46";
    const earthColor = styles.getPropertyValue("--color-surface").trim() || "#0f1826";
    const mutedColor = styles.getPropertyValue("--color-muted").trim() || "#8a9e92";

    let raf = 0;
    let running = true;

    // 육지 그리드는 프레임마다 3천여 개 사각형을 다시 칠하지 않도록 오프스크린에 1회 렌더
    let mapLayer: HTMLCanvasElement | null = null;
    const buildMapLayer = (w: number, h: number, dpr: number) => {
      mapLayer = document.createElement("canvas");
      mapLayer.width = Math.round(w * dpr);
      mapLayer.height = Math.round(h * dpr);
      const mctx = mapLayer.getContext("2d");
      if (!mctx) return;
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cw = w / WORLD_GRID_W;
      const ch = h / WORLD_GRID_H;
      mctx.fillStyle = earthColor;
      for (let gy = 0; gy < WORLD_GRID_H; gy++) {
        for (let gx = 0; gx < WORLD_GRID_W; gx++) {
          if (isLandCell(gx, gy)) {
            // 픽셀 블록 미감: 셀 사이 미세한 틈을 남긴다
            mctx.fillRect(gx * cw, gy * ch, cw * 0.92, ch * 0.92);
          }
        }
      }
      // 경위도 그리드 (30° 간격)
      mctx.strokeStyle = gridColor;
      mctx.globalAlpha = 0.35;
      mctx.lineWidth = 1;
      for (let lon = -150; lon <= 150; lon += 30) {
        const x = ((lon + 180) / 360) * w;
        mctx.beginPath();
        mctx.moveTo(x, 0);
        mctx.lineTo(x, h);
        mctx.stroke();
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const y = ((90 - lat) / 180) * h;
        mctx.beginPath();
        mctx.moveTo(0, y);
        mctx.lineTo(w, y);
        mctx.stroke();
      }
      // 적도 강조
      mctx.globalAlpha = 0.55;
      mctx.beginPath();
      mctx.moveTo(0, h / 2);
      mctx.lineTo(w, h / 2);
      mctx.stroke();
      mctx.globalAlpha = 1;
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (rect.width >= 2) buildMapLayer(rect.width, rect.height, dpr);
      if (reduceMotion) {
        cancelAnimationFrame(raf);
        draw();
      }
    };

    const toXY = (g: { latitude: number; longitude: number }, w: number, h: number) => ({
      x: ((g.longitude + 180) / 360) * w,
      y: ((90 - g.latitude) / 180) * h,
    });

    const draw = () => {
      const snap = snapshotRef.current;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w < 2 || h < 2) {
        if (running) raf = requestAnimationFrame(draw);
        return;
      }
      if (!mapLayer) buildMapLayer(w, h, window.devicePixelRatio || 1);

      const vt = tickOrbitClock(clock, speedRef.current);

      ctx.clearRect(0, 0, w, h);
      if (mapLayer) ctx.drawImage(mapLayer, 0, 0, w, h);

      // 음영(밤) 반구 — ECI 에서 x<0 인 경도대(90°~270°)를 지표 경도로 환산해 어둡게.
      // lib/space.ts 의 음영 규약(태양=+x)과 동일한 모델이다.
      const rotDeg = ((EARTH_ROTATION_RAD_S * vt * DEG) % 360 + 360) % 360;
      let nightStart = 90 - rotDeg; // 지표 경도 기준 밤의 서쪽 끝
      nightStart = ((nightStart % 360) + 540) % 360 - 180;
      const nx = ((nightStart + 180) / 360) * w;
      ctx.fillStyle = "#000";
      ctx.globalAlpha = 0.32;
      if (nx + w / 2 <= w) {
        ctx.fillRect(nx, 0, w / 2, h);
      } else {
        ctx.fillRect(nx, 0, w - nx, h);
        ctx.fillRect(0, 0, nx + w / 2 - w, h);
      }
      ctx.globalAlpha = 1;

      // 관측 대상의 지상 궤적(앞뒤 반 주기씩) — 날짜변경선에서 선을 끊는다
      const fj = focusRef.current;
      if (fj) {
        const period = (2 * Math.PI) / fj.orbit.angularVelocity;
        const N = 128;
        ctx.strokeStyle = fj.color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        let prevX: number | null = null;
        for (let k = 0; k <= N; k++) {
          const ts = vt + (k / N - 0.5) * period;
          const p = toXY(groundStateAt(fj.orbit, ts), w, h);
          if (prevX === null || Math.abs(p.x - prevX) > w / 2) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
          prevX = p.x;
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 전체 줍스 현재 위치
      for (const j of snap.joops) {
        if (fj && j.id === fj.id) continue; // 관측 대상은 마지막에 크게
        const p = toXY(groundStateAt(j.orbit, vt), w, h);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = j.color;
        ctx.globalAlpha = 0.8;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 관측 대상 — 내 줍스면 애니메이션 스프라이트, 아니면 큰 점 + 조준 링 + 이름
      if (fj) {
        const p = toXY(groundStateAt(fj.orbit, vt), w, h);
        const sheet = sheetRef.current;
        if (sheet && sheet.complete && sheet.naturalWidth > 0) {
          const size = Math.max(20, Math.min(w, h) * 0.16);
          // 프레임 진행은 실시간 기준(게임 배속을 곱하면 깜빡인다)
          const frame = spriteFrame("move", performance.now() / 1000, reduceMotion);
          ctx.drawImage(
            sheet,
            frame * JOOP_FRAME,
            0,
            JOOP_FRAME,
            JOOP_FRAME,
            p.x - size / 2,
            p.y - size / 2,
            size,
            size,
          );
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
          ctx.fillStyle = fj.color;
          ctx.shadowColor = fj.color;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        ctx.strokeStyle = fj.color;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.stroke();
        // 십자선
        ctx.beginPath();
        ctx.moveTo(p.x - 13, p.y);
        ctx.lineTo(p.x - 8, p.y);
        ctx.moveTo(p.x + 8, p.y);
        ctx.lineTo(p.x + 13, p.y);
        ctx.moveTo(p.x, p.y - 13);
        ctx.lineTo(p.x, p.y - 8);
        ctx.moveTo(p.x, p.y + 8);
        ctx.lineTo(p.x, p.y + 13);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = mutedColor;
        ctx.font = "9px ui-monospace, monospace";
        ctx.textBaseline = "bottom";
        ctx.textAlign = p.x < w - 60 ? "left" : "right";
        ctx.fillText(fj.name, p.x + (p.x < w - 60 ? 12 : -12), p.y - 6);
        ctx.textAlign = "left";
      }

      if (running && !reduceMotion) raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    draw();

    const onVisibility = () => {
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
    // clock 은 부모가 소유한 가변 ref 객체라 재구독이 필요 없다
  }, [clock]);

  // ── 위성 모니터링 지표(DOM) — rAF 가 아니라 0.5초 틱으로만 리렌더를 유발하고,
  //    값 자체는 렌더 시 가상 시계에서 파생 계산한다(순수 계산이라 렌더 중 호출 안전).
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  const ground: GroundState | null = focus ? groundStateAt(focus.orbit, clock.vt) : null;
  // 교신 여부는 게임 규칙(설정된 음영 비율)을 따른다 — ground.inShadow(물리 x<0)를 쓰면
  // 서버가 판정한 LinkStatus 와 어긋난다.
  const linked = focus ? !shadowStateAt(focus.orbit, clock.vt, shadowFraction).inShadow : false;

  const t = dict.space;
  const cell = (label: string, value: string, tone?: string) => (
    <div
      className="flex flex-col gap-0.5 rounded-md border px-2 py-1.5"
      style={{ borderColor: "var(--color-neutral-600)", background: "var(--color-surface)" }}
    >
      <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted)]">
        {label}
      </span>
      <span className="font-mono text-xs" style={{ color: tone ?? "var(--color-fg)" }}>
        {value}
      </span>
    </div>
  );

  if (!focus) {
    return <div className={`${mini ? "aspect-[3/1]" : "aspect-[2/1]"} w-full`} />;
  }

  const latH = ground ? `${Math.abs(ground.latitude).toFixed(0)}°${ground.latitude >= 0 ? "N" : "S"}` : "—";
  const lonH = ground ? `${Math.abs(ground.longitude).toFixed(0)}°${ground.longitude >= 0 ? "E" : "W"}` : "—";
  const region = ground ? regionAt(ground.latitude, ground.longitude)[lang] : "—";

  return (
    <div>
      <canvas
        ref={canvasRef}
        className={`block w-full ${mini ? "aspect-[3/1] opacity-85" : "aspect-[2/1]"}`}
        role="img"
        aria-label={`${dict.firstScreen.tracking}: ${focus.name} — ${region}`}
      />
      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
        {dict.firstScreen.tracking}:{" "}
        <span style={{ color: focus.color }}>{focus.name}</span>
        {myJoopId && focus.id === myJoopId ? ` · ${dict.home.myJoop}` : ""}
      </p>
      {showIndicators && (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {cell(t.overhead, `${region} (${latH} ${lonH})`)}
          {cell(t.altitude, ground ? `${ground.altitudeKm.toLocaleString()} km` : "—")}
          {cell(t.speed, ground ? `${ground.speedKms} km/s` : "—")}
          {cell(
            t.link,
            linked ? t.linkActive : t.shadowAuto,
            linked ? "var(--color-primary)" : "var(--color-secondary)",
          )}
        </div>
      )}
    </div>
  );
}
