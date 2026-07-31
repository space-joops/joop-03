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
import { JOOP_FRAME, joopSheetPath, sheetForColor, spriteFrame } from "@joop/arcade-engine";
import { TelemetryBar, launchEventLabel } from "@/components/telemetry-bar";
import * as sfx from "@joop/arcade-engine";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { trackLaunchCompleted } from "@/lib/analytics";

type Phase = "countdown" | "ascent" | "saving" | "done";

// 발사체 벡터(실사풍 마스터): 64×256, anchor 하단 중앙 [32,250](노즐 배출구).
// ⚠️ ratio 가 0.4 → 0.25 로 얇아졌으므로, ROCKET_RATIO 를 곱해 만드는 폭 계수들은
//    전부 1.6배 보정돼 있다(화염·컷어웨이·낙하·타워). 프레임을 다시 바꾸면 같이 고칠 것.
const ROCKET_SRC = "/game/rocket.svg";
const CUBESAT_SRC = "/game/cubesat.svg";
const ROCKET_RATIO = 64 / 256; // w/h
const ROCKET_NOZZLE = 250 / 256; // 이미지 상단 기준 노즐 y 비율
const NOSE_FRAC = 62 / 256; // 페어링 끝 — 분리 후 크롭 시작점
const STAGE1_FRAC = 130 / 256; // 1단 시작 — 단 분리 후 크롭 끝점

type RocketSrc = HTMLImageElement | HTMLCanvasElement | null;
const srcReady = (s: RocketSrc) =>
  !!s && ("naturalWidth" in s ? s.complete && s.naturalWidth > 0 : s.width > 0);

/**
 * 로켓을 노즐 기준점(nx, ny)에 높이 h 로 그린다. 이미지가 없으면 폴백 막대.
 * crop: 세로 비율 구간만 그린다 — 페어링 분리(top)·단 분리(bottom)를 "실제로 잘라" 표현.
 */
function drawRocket(
  ctx: CanvasRenderingContext2D,
  src: RocketSrc,
  nx: number,
  ny: number,
  h: number,
  fallbackColor: string,
  crop?: { top?: number; bottom?: number },
) {
  if (srcReady(src)) {
    const img = src as CanvasImageSource & { width: number; height: number; naturalWidth?: number; naturalHeight?: number };
    const natW = img.naturalWidth ?? img.width;
    const natH = img.naturalHeight ?? img.height;
    const top = crop?.top ?? 0;
    const bottom = crop?.bottom ?? 1;
    const w = h * ROCKET_RATIO;
    ctx.drawImage(
      img,
      0,
      natH * top,
      natW,
      natH * (bottom - top),
      nx - w / 2,
      ny - h * ROCKET_NOZZLE + h * top,
      w,
      h * (bottom - top),
    );
  } else {
    const w = h * 0.28;
    ctx.beginPath();
    ctx.roundRect(nx - w / 2, ny - h * 0.95, w, h * 0.9, w * 0.3);
    ctx.fillStyle = fallbackColor;
    ctx.fill();
  }
}

/**
 * 발사체 프로필 색 틴트 — multiply 로 셰이딩을 보존하고 destination-in 으로 알파 복구.
 * source-atop 단일 패스는 평면 채색이라 금속 그라디언트를 죽인다.
 */
function buildTintedRocket(img: HTMLImageElement, tint: string): HTMLCanvasElement | null {
  if (!img.complete || img.naturalWidth === 0) return null;
  const w = 64 * 4;
  const h = 256 * 4;
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const o = off.getContext("2d");
  if (!o) return null;
  o.drawImage(img, 0, 0, w, h);
  o.globalCompositeOperation = "multiply";
  o.fillStyle = tint;
  o.fillRect(0, 0, w, h);
  o.globalCompositeOperation = "destination-in";
  o.drawImage(img, 0, 0, w, h);
  return off;
}

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/** 25% 오버슛 후 정착(줍스 팝) — easeOutBack. u≤0 → 0, u=1 → 1. */
const easeBack = (u: number) => {
  const p = Math.max(0, Math.min(1, u)) - 1;
  return 1 + 3.9 * p * p * p + 2.9 * p * p;
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
  sequenceSeconds = 180,
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
  const cubesatRef = useRef<HTMLImageElement | null>(null);
  const joopSheetRef = useRef<HTMLImageElement | null>(null);
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
  // 프로필 색이 입혀진 로켓(오프스크린) — 두 장면(발사대·상승)이 공유한다.
  const tintedRef = useRef<HTMLCanvasElement | null>(null);
  const bodyColor = profile.bodyColor;

  // 에셋 선로딩 — 실패해도 폴백 도형으로 진행한다(로드 게이트 없음).
  // 줍스 시트는 색별 파일이라 [color] deps, 틴트는 프로필 색에 의존해 [bodyColor] —
  // 상승 effect deps 에 color·profile 이 이미 있어 추가 루프 재시작은 없다.
  useEffect(() => {
    const rocket = new Image();
    rocket.src = ROCKET_SRC;
    rocketRef.current = rocket;
    const tint = () => {
      tintedRef.current = buildTintedRocket(rocket, bodyColor);
    };
    if (rocket.complete) tint();
    else rocket.addEventListener("load", tint, { once: true });
    const cube = new Image();
    cube.src = CUBESAT_SRC;
    cubesatRef.current = cube;
    const joop = new Image();
    joop.src = joopSheetPath(sheetForColor(color));
    joopSheetRef.current = joop;
  }, [color, bodyColor]);

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
      const padY = H * 0.93;
      ctx.strokeStyle = grid;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, padY);
      ctx.lineTo(W, padY);
      ctx.stroke();
      const rocketH = Math.min(W, H) * 0.14 * 3.4; // 발사대 ×3.4 (실사 프레임에 맞춰 확대)
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = grid;
      ctx.lineWidth = 3;
      ctx.beginPath();
      // 폭 계수 1.44 = 기존 0.9 × 1.6 보정(ROCKET_RATIO 0.4→0.25)
      ctx.moveTo(W / 2 + rocketH * ROCKET_RATIO * 1.44, padY);
      ctx.lineTo(W / 2 + rocketH * ROCKET_RATIO * 1.44, padY - rocketH * 1.05);
      ctx.stroke();
      ctx.globalAlpha = 1;

      drawRocket(ctx, tintedRef.current ?? rocketRef.current, W / 2, padY, rocketH, profile.bodyColor);
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
          if (!reduce && c > 0) sfx.lnchCountdown(c);
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
    // 실사 지구(아케이드·궤도 화면과 같은 bg-earth.webp) — 사출 구간의 배경.
    // 2048² 원본을 매 프레임 축소해 그리면 비싸므로 표시 최대 크기로 1회 캐시한다.
    const earthImg = new Image();
    earthImg.src = "/game/bg-earth.webp";
    let earthCache: HTMLCanvasElement | null = null;
    let earthCacheSize = 0;
    const buildEarthCache = () => {
      if (!earthImg.complete || earthImg.naturalWidth === 0 || W < 2 || H < 2) return;
      const dpr = window.devicePixelRatio || 1;
      // 최대 지름(42%) × 최대 줌(1.75) 기준 — 이보다 크게 그릴 일은 없다.
      const px = Math.max(2, Math.round(Math.min(W, H) * 0.42 * 1.75 * dpr));
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
    earthImg.addEventListener("load", buildEarthCache);

    resize();
    buildEarthCache();
    const observer = new ResizeObserver(() => {
      resize();
      buildEarthCache();
    });
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
    const tFairing = at("fairing");
    const tDeploy = at("deploy");

    // 사출 창(180초 기준 ≈50초) 안의 하위 단계 시각
    const dW = Math.max(1, total - tDeploy);
    const tJoop = tDeploy + dW * 0.4; // 해치 개방·줍스 전개 시작
    const tPing = tDeploy + dW * 0.49; // "삐링~" — jT 0.15 지점, 줌 최대와 일치

    // ── 줌 카메라 ──────────────────────────────────────────────────────────
    // 이벤트 앵커 키프레임. 리프트오프 클로즈업 → 상승하며 풀아웃 → SECO 에서 1.0
    // (지구가 들어올 자리를 연다) → 사출 클로즈업 → 궤도 진입 풀아웃.
    // 최대가 1.75 인 이유: "삐링~" 순간에 줍스와 지구가 **한 프레임**에 있어야 한다.
    // 앵커 고정형(translate/scale/translate)이라 s=1 이면 항등 변환이다.
    const ZOOM: [number, number][] = [
      [0, 2.4],
      [tMaxQ, 1.6],
      [tMeco, 1.25],
      [tSecond, 1.45],
      [tSeco, 1.0],
      [tDeploy, 1.45],
      [tPing, 1.75],
      [total, 1.0],
    ];
    const zoomAt = (t: number) => {
      if (reduce) return 1; // 모션 최소화: 카메라 이동 없음
      for (let i = 1; i < ZOOM.length; i++) {
        const [t1, s1] = ZOOM[i];
        if (t <= t1) {
          const [t0, s0] = ZOOM[i - 1];
          return s0 + (s1 - s0) * smooth((t - t0) / Math.max(0.001, t1 - t0));
        }
      }
      return 1;
    };

    // ── 사운드 ────────────────────────────────────────────────────────────
    // 억제 규칙: reduce 는 종료 징글 1발만(자극 최소화), 16× 는 핵심 3개만,
    // 4× 는 부수 이벤트 제외. 배속은 ref 라 매 프레임 최신값을 읽는다.
    const KEY_EVENTS: LaunchEventId[] = ["liftoff", "deploy", "orbitInsertion"];
    const MINOR_EVENTS: LaunchEventId[] = ["maxQ", "seco", "fairing"];
    const audible = (id: LaunchEventId) => {
      if (reduce) return id === "orbitInsertion";
      const sp = speedRef.current;
      if (sp >= 16) return KEY_EVENTS.includes(id);
      if (sp >= 4) return !MINOR_EVENTS.includes(id);
      return true;
    };
    const playEvent = (id: LaunchEventId) => {
      switch (id) {
        case "liftoff":
          return sfx.lnchLiftoff();
        case "maxQ":
          return sfx.lnchMaxQ();
        case "meco":
          return sfx.lnchMeco();
        case "separation":
          return sfx.lnchSeparation();
        case "secondIgnition":
          return sfx.lnchIgnition();
        case "boosterLanding":
          return sfx.lnchLanding();
        case "seco":
          return sfx.lnchSeco();
        case "fairing":
          return sfx.lnchFairing();
        case "deploy":
          return sfx.lnchCubesat();
        case "orbitInsertion":
          return sfx.lnchOrbitJingle();
      }
    };

    let raf = 0;
    let running = true;
    let vElapsed = 0;
    let lastTs = performance.now();
    let stageIdx = 0;
    let launched = false; // completeLaunch 조기 호출 1회 가드
    let lastShownSec = -1;
    let lastShownSpeed = -1;
    // 16× 는 한 프레임에 이벤트를 2개 지날 수 있다 — while 안에서 예약만 하고
    // 루프 밖에서 프레임당 1발만 울린다(보이스 낭비·뭉개짐 방지).
    let pendingSfx: LaunchEventId | null = null;
    let pinged = false; // "삐링~" 1회 가드

    const finish = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      sfx.lnchEngineStop();
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
        if (audible(ev.id)) pendingSfx = ev.id;
        // 사출 시점에 궤도 진입을 미리 저장(서버 멱등) — 끝나면 결과만 기다린다.
        if (ev.id === "deploy" && mode === "live" && !launched) {
          launched = true;
          launchPromiseRef.current = completeLaunch().catch(() => ({ ok: false }));
        }
      }

      if (pendingSfx) {
        playEvent(pendingSfx);
        pendingSfx = null;
      }
      // "삐링~" — 줍스가 큐브샛에서 나오는 순간(이벤트가 아니라 시각 앵커라 별도 가드)
      if (!pinged && vElapsed >= tPing) {
        pinged = true;
        if (!reduce) sfx.lnchDeployPing();
      }
      // 엔진 루프 — 화염 게이트(burning)와 같은 조건. 루프 중복 생성은 엔진이 막는다.
      if (!reduce && (vElapsed < tMeco || (vElapsed >= tSecond && vElapsed < tSeco))) {
        sfx.lnchEngine(vElapsed >= tSecond);
      } else {
        sfx.lnchEngineStop();
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

      // 부스터 착륙 컷어웨이(프로필 해당 시, tBL±cutHalf) — 별도 장면·독립 카메라(줌 미적용).
      // 짧은 시퀀스 설정에서 컷이 SECO 를 침범하지 않도록 폭을 총 길이에 묶는다.
      const cutHalf = Math.min(4, total * 0.03);
      const inCutaway = tBL >= 0 && vElapsed >= tBL - cutHalf && vElapsed <= tBL + cutHalf;
      if (inCutaway) {
        const ct = (vElapsed - (tBL - cutHalf)) / (cutHalf * 2); // 0→1
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
        // 하강하는 부스터(그리드 핀 + 착륙 연소). ×1.9 — 실사 프레임(64×256)에 맞춘 확대.
        const bh = Math.min(W, H) * 0.14 * 1.9 * profile.stageRatio;
        const by = H * 0.12 + smooth(ct) * (shipY - H * 0.12);
        const landed = by >= shipY - 1;
        // ⚠️ 아래 폭 계수들은 전부 1.6배 보정본이다(ROCKET_RATIO 0.4→0.25).
        ctx.save();
        // 1단 실물(그리드핀·그을음·옥타웹)을 크롭해 그린다 — 마스터의 STAGE1_FRAC~끝 구간.
        // 전체 높이 bh/(1-STAGE1_FRAC) 로 넘겨야 잘린 조각이 bh 가 된다.
        drawRocket(
          ctx,
          tintedRef.current ?? rocketRef.current,
          W / 2,
          by,
          bh / (1 - STAGE1_FRAC),
          profile.bodyColor,
          { top: STAGE1_FRAC },
        );
        // 착륙 다리(마지막 20%)
        if (ct > 0.75) {
          ctx.strokeStyle = profile.accentColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(W / 2 - bh * ROCKET_RATIO * 0.48, by);
          ctx.lineTo(W / 2 - bh * ROCKET_RATIO * 1.12, by + bh * 0.12);
          ctx.moveTo(W / 2 + bh * ROCKET_RATIO * 0.48, by);
          ctx.lineTo(W / 2 + bh * ROCKET_RATIO * 1.12, by + bh * 0.12);
          ctx.stroke();
        }
        // 착륙 연소(착지 전)
        if (!landed && ct > 0.25) {
          const fl = bh * (0.5 + (reduce ? 0 : Math.random() * 0.2));
          ctx.beginPath();
          ctx.moveTo(W / 2 - bh * ROCKET_RATIO * 0.32, by);
          ctx.lineTo(W / 2 + bh * ROCKET_RATIO * 0.32, by);
          ctx.lineTo(W / 2, by + fl);
          ctx.closePath();
          ctx.fillStyle = amber;
          ctx.globalAlpha = 0.9;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      } else {
        // ── 메인 장면 — 상승/항행/사출 ────────────────────────────────────
        // 순서: ① 배율 s(시간만의 함수) ② 월드 좌표 ③ 카메라 앵커 ④ 그리기.
        // 좌표를 먼저 확정해야 앵커(줍스·지구 가중 중점)를 계산할 수 있다.
        const s = zoomAt(vElapsed);

        const liftT = smooth(vElapsed / Math.max(1, tMaxQ)); // 초반 이륙 카메라
        const rh = Math.min(W, H) * 0.14 * 1.6;
        const separated = vElapsed >= tSep;
        // 단·페어링 분리는 크기 축소가 아니라 **크롭**이다(실제로 잘려 나간다).
        const cropTop = tFairing >= 0 && vElapsed >= tFairing ? NOSE_FRAC : 0;
        const cropBottom = separated ? STAGE1_FRAC : 1;

        // 사출 후 2단은 우상단으로 천천히 멀어진다(주인공 자리를 큐브샛에 넘김)
        const stageDrift = vElapsed > tDeploy ? smooth((vElapsed - tDeploy) / (dW * 0.5)) : 0;
        // Max-Q 진동 — 줌으로 나눠 화면상 진폭을 유지(×1.25 는 체감 보정)
        const shakeX =
          vElapsed >= tMaxQ - 3 && vElapsed <= tMaxQ + 3 && !reduce
            ? ((Math.random() - 0.5) * 4 * 1.25) / s
            : 0;
        const rx = W / 2 + stageDrift * W * 0.34 + shakeX;
        // 초반: 발사대에서 화면 중앙까지 상승, 이후 중앙 고정(배경이 흐름)
        const ny = H * 0.88 - liftT * H * 0.33 - stageDrift * H * 0.22;
        // 크롭에 따라 실제 엔진/노즈가 있는 y (화염·사출구 기준점)
        const engineY = ny - rh * (ROCKET_NOZZLE - Math.min(cropBottom, ROCKET_NOZZLE));
        const noseY = ny - rh * ROCKET_NOZZLE + rh * cropTop;

        // (a) 멀리 지구 — SECO~사출 사이에 좌하에서 서서히 떠오른다
        const earthK = smooth((vElapsed - tSeco) / Math.max(1, tDeploy - tSeco));
        // ey 계수는 SECO 직후(earthK≈0.15)에 이미 화면 하단에 림이 걸리도록 잡았다 —
        // "SECO 풀아웃 = 지구 등장"이 카메라와 같은 박자여야 한다.
        const earthR = (Math.min(W, H) * (0.22 + 0.2 * earthK)) / 2;
        const ex = W * (0.1 + 0.24 * earthK);
        const ey = H * (1.06 - 0.18 * earthK);

        // (c) 큐브샛 — 2단 상부에서 지구 쪽으로 이탈해 한 바퀴 텀블 후 정지
        const baseNy = H * 0.55; // liftT=1 이후의 로켓 정지 y (사출 시점 기준점)
        const cubeS = smooth((vElapsed - tDeploy) / (dW * 0.35));
        const cs = Math.min(W, H) * 0.13;
        const ccx = W / 2 + cubeS * (W * 0.4 - W / 2);
        const ccy = baseNy - rh * ROCKET_NOZZLE + rh * NOSE_FRAC + cubeS * H * 0.16;
        // 한 바퀴(2π) 돌고 −0.35rad 로 정착 → 해치가 위를 향한다. 이후는 아주 느린 잔류 회전.
        const cang =
          cubeS * (Math.PI * 2 - 0.35) + Math.max(0, vElapsed - (tDeploy + dW * 0.35)) * 0.02;
        // 해치 중심(로컬 [0, −0.25·cs])을 텀블 각으로 회전 → 월드 좌표
        const hx = ccx + 0.25 * cs * Math.sin(cang);
        const hy = ccy - 0.25 * cs * Math.cos(cang);

        // (d)(e) 줍스 전개 → 궤도 수렴
        const jT = Math.max(0, Math.min(1, (vElapsed - tJoop) / (dW * 0.6)));
        const oRx = earthR * 2.15;
        const oRy = earthR * 0.66;
        const orbT = smooth((vElapsed - tPing) / Math.max(1, total - tPing));
        const jxBase = hx - jT * W * 0.1;
        const jyBase = hy - cs * 0.2 - jT * H * 0.1;
        const jx = jxBase + (ex + Math.cos(Math.PI * 1.55) * oRx - jxBase) * orbT;
        const jy = jyBase + (ey + Math.sin(Math.PI * 1.55) * oRy - jyBase) * orbT;

        // 카메라 앵커 — 사출 전엔 로켓 중심, 사출 후엔 줍스 60% : 지구 40% 가중 중점.
        // 앵커 고정형이라 s=1 이면 항등 변환(= 기존 레이아웃 그대로).
        const blend = smooth((vElapsed - tDeploy) / (dW * 0.3));
        const ax = rx + (jx * 0.6 + ex * 0.4 - rx) * blend;
        const ay =
          (noseY + engineY) / 2 + (jy * 0.6 + ey * 0.4 - (noseY + engineY) / 2) * blend;

        ctx.save();
        ctx.translate(ax, ay);
        ctx.scale(s, s);
        ctx.translate(-ax, -ay);
        // ⚠️ 이 안에서는 shadowBlur·lineWidth 를 /s 로 보정한다(화면상 굵기 유지).

        // 발사대(이륙 직후까지 아래로 스크롤 아웃)
        if (vElapsed < tMaxQ) {
          const padY = H * 0.86 + liftT * H * 0.5;
          ctx.strokeStyle = grid;
          ctx.lineWidth = 2 / s;
          ctx.beginPath();
          ctx.moveTo(0, padY);
          ctx.lineTo(W, padY);
          ctx.stroke();
        }

        // 궤도 링 뒤 반원 — 지구에 가려야 깊이감이 산다(그래서 지구보다 먼저).
        // 지구와 좌표를 공유해야 하므로 줌 **안**에서 그린다.
        if (orbT > 0) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2 / s;
          ctx.globalAlpha = 0.25 * orbT;
          ctx.beginPath();
          ctx.ellipse(ex, ey, oRx, oRy, 0, Math.PI, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // (a) 지구 디스크 — 대기 림 + 실사 텍스처. 캐시 실패 시 단색 폴백.
        if (earthK > 0) {
          ctx.save();
          const rim = ctx.createRadialGradient(ex, ey, earthR * 0.9, ex, ey, earthR * 1.2);
          rim.addColorStop(0, "rgba(120,190,255,0.38)");
          rim.addColorStop(1, "rgba(120,190,255,0)");
          ctx.fillStyle = rim;
          ctx.beginPath();
          ctx.arc(ex, ey, earthR * 1.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ex, ey, earthR, 0, Math.PI * 2);
          ctx.clip();
          if (earthCache) {
            ctx.translate(ex, ey);
            // 아주 느린 **롤**(시선축 회전) — 자전처럼 텍스처를 흘리면 대륙이 미끄러진다.
            ctx.rotate(vElapsed * 0.004);
            ctx.drawImage(earthCache, -earthR, -earthR, earthR * 2, earthR * 2);
          } else {
            ctx.fillStyle = surface;
            ctx.fillRect(ex - earthR, ey - earthR, earthR * 2, earthR * 2);
          }
          ctx.restore();
        }

        // 궤도 링 앞 반원
        if (orbT > 0) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2 / s;
          ctx.globalAlpha = 0.8 * orbT;
          ctx.beginPath();
          ctx.ellipse(ex, ey, oRx, oRy, 0, 0, Math.PI);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // 분리된 1단(분리~+8초 낙하)
        if (separated && vElapsed < tSep + 8) {
          const st = (vElapsed - tSep) / 8;
          const sh = rh * profile.stageRatio * 0.8;
          const sy = engineY + st * H * 0.9;
          ctx.globalAlpha = 1 - st * 0.5;
          ctx.fillStyle = profile.bodyColor;
          ctx.fillRect(rx - sh * ROCKET_RATIO * 0.48, sy, sh * ROCKET_RATIO * 0.96, sh * 0.5);
          ctx.globalAlpha = 1;
        }

        // 화염 — MECO 전(1단) / 2단 점화~SECO(작고 밝은 코어).
        // ⚠️ 폭 계수는 1.6배 보정본이다(ROCKET_RATIO 0.4→0.25 로 rw 가 좁아졌다).
        const burning = vElapsed < tMeco || (vElapsed >= tSecond && vElapsed < tSeco);
        if (burning) {
          const second = vElapsed >= tSecond;
          const rw = rh * ROCKET_RATIO;
          // 2단은 진공 노즐 — 짧고 넓은 플룸(길고 뾰족하면 아이스크림 콘처럼 읽힌다)
          const flameLen = rh * (second ? 0.24 : 0.45) * (reduce ? 1 : 0.9 + Math.random() * 0.2);
          ctx.beginPath();
          ctx.moveTo(rx - rw * (second ? 0.36 : 0.448), engineY);
          ctx.lineTo(rx + rw * (second ? 0.36 : 0.448), engineY);
          ctx.lineTo(rx, engineY + flameLen);
          ctx.closePath();
          ctx.fillStyle = second ? "#cfe8ff" : amber;
          ctx.globalAlpha = 0.9;
          ctx.fill();
          if (!second) {
            ctx.beginPath();
            ctx.moveTo(rx - rw * 0.224, engineY);
            ctx.lineTo(rx + rw * 0.224, engineY);
            ctx.lineTo(rx, engineY + flameLen * 0.55);
            ctx.closePath();
            ctx.fillStyle = "#f2f7f0";
            ctx.globalAlpha = 0.85;
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        // 로켓 본체(프로필 색 틴트본 우선). 사출 후엔 멀어지며 흐려진다.
        ctx.globalAlpha = 1 - stageDrift * 0.65;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14 / s;
        drawRocket(ctx, tintedRef.current ?? rocketRef.current, rx, ny, rh, profile.bodyColor, {
          top: cropTop,
          bottom: cropBottom,
        });
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // (b) 페어링 분리 — ogive 반쪽 2조각이 회전하며 이탈(마스터 좌표 그대로 축소).
        if (tFairing >= 0 && vElapsed >= tFairing && vElapsed < tFairing + 6) {
          const e = smooth((vElapsed - tFairing) / 6);
          const u = rh / 256; // 마스터 1단위 = rh/256
          const topY = ny - rh * ROCKET_NOZZLE + rh * 0.12;
          for (const side of [-1, 1]) {
            ctx.save();
            ctx.globalAlpha = 1 - e * 0.85;
            ctx.translate(rx + side * e * W * 0.3, topY - e * H * 0.12);
            ctx.rotate(side * e * 1.9);
            ctx.beginPath();
            ctx.moveTo(0, -29 * u);
            ctx.bezierCurveTo(side * 13 * u, -4 * u, side * 15 * u, 16 * u, side * 15 * u, 32 * u);
            ctx.lineTo(0, 32 * u);
            ctx.closePath();
            ctx.fillStyle = profile.bodyColor;
            ctx.fill();
            ctx.strokeStyle = profile.accentColor;
            ctx.lineWidth = 1 / s;
            ctx.stroke();
            ctx.restore();
          }
        }

        // (c) 큐브샛 — 텀블 + 해치 뚜껑(힌지 회전) + 스프링 파티클
        if (vElapsed >= tDeploy) {
          const cube = cubesatRef.current;
          ctx.save();
          ctx.translate(ccx, ccy);
          ctx.rotate(cang);
          if (cube?.complete && cube.naturalWidth > 0) {
            ctx.drawImage(cube, -cs / 2, -cs / 2, cs, cs);
          } else {
            ctx.fillStyle = "#c9a227";
            ctx.fillRect(-cs * 0.16, -cs * 0.28, cs * 0.32, cs * 0.56);
          }
          // 마스터의 해치(x48 y28 w32 h8, viewBox 128) 위에 뚜껑을 덮고 힌지로 연다
          ctx.translate(-cs * 0.125, -cs * 0.28125);
          ctx.rotate(-smooth(jT / 0.2) * 2);
          ctx.fillStyle = "#efe6c8";
          ctx.fillRect(0, -cs * 0.03, cs * 0.25, cs * 0.0625);
          ctx.restore();

          // 스프링 파티클 4개 — 사출 반작용
          if (cubeS < 1) {
            ctx.fillStyle = muted;
            for (let i = 0; i < 4; i++) {
              const a = Math.PI * (0.8 + i * 0.15);
              const d = cubeS * cs * (0.9 + i * 0.2);
              ctx.globalAlpha = 0.7 * (1 - cubeS);
              ctx.beginPath();
              ctx.arc(W / 2 + Math.cos(a) * d, ccy + Math.sin(a) * d * 0.6, 1.6 / s, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
        }

        // (d) 줍스 전개 — 25% 오버슛 팝 + 확장 링 2개. 이 구간의 shadowBlur 는 여기 한 번뿐.
        if (jT > 0) {
          const jSize = Math.min(W, H) * 0.11 * easeBack(jT / 0.35);
          const sheet = joopSheetRef.current;
          if (jT < 0.55) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2 / s;
            for (let i = 0; i < 2; i++) {
              const rt = Math.min(1, Math.max(0, jT / 0.35 - i * 0.35));
              if (rt <= 0 || rt >= 1) continue;
              ctx.globalAlpha = 0.55 * (1 - rt);
              ctx.beginPath();
              ctx.arc(hx, hy, jSize * (0.4 + rt * 1.4), 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = 12 / s;
          if (sheet?.complete && sheet.naturalWidth > 0) {
            const fr = spriteFrame(jT < 0.5 ? "collect" : "idle", vElapsed, reduce);
            ctx.drawImage(
              sheet,
              fr * JOOP_FRAME,
              0,
              JOOP_FRAME,
              JOOP_FRAME,
              jx - jSize / 2,
              jy - jSize / 2,
              jSize,
              jSize,
            );
          } else {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(jx, jy, jSize * 0.22, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        ctx.restore(); // 줌 종료
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
      if (document.hidden) sfx.stopAll(); // 탭 전환 중 엔진음이 계속 울리지 않게
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
      sfx.stopAll(); // 화면 이탈 시 엔진 루프 누수 방지
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
