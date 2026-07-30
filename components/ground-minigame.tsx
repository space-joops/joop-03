"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ALL_ITEMS,
  DEBRIS_FRAME,
  DEBRIS_SHEET,
  DEFAULT_CONFIG,
  HAZARD_ITEMS,
  SAFE_ITEMS,
  bondFrom,
  bondTier,
  fallSpeedAt,
  pickItem,
  spawnIntervalAt,
  type FallingItem,
  type MinigameConfig,
} from "@/lib/minigame";
import { submitMinigameResult } from "@/app/[lang]/joop/actions";
import * as sfx from "@/lib/sound";
import { trackMinigameCompleted } from "@/lib/analytics";
import {
  JOOP_FEET_Y,
  JOOP_FRAME,
  joopSheetPath,
  sheetForColor,
  spriteFrame,
  type JoopSpriteState,
} from "@/lib/joop-sprite";
import { JoopSprite } from "@/components/joop-sprite";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

type Phase = "ready" | "playing" | "over" | "saving" | "saved";

type Summary = {
  caught: number;
  missed: number;
  hits: number;
  bond: number;
  reason: "time" | "broken";
};

// 지상 훈련: 줍스는 땅에 서서 좌우로만 움직인다.
// 위에서 떨어지는 것들 중 "우주 쓰레기"는 받아내고, "작동 중인 위성"은 피한다(식별 훈련).
// 조작 = 화면을 좌우로 끌기(모바일) / ← → 키(데스크톱).
export function GroundMinigame({
  lang,
  dict,
  color,
  config,
}: {
  lang: Locale;
  dict: Dictionary;
  color: string;
  /** joop_03_game_config 에서 읽어 서버가 주입. 없으면 코드 기본값(EPIC 10 / FR-10.2). */
  config?: MinigameConfig;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ready");
  const [assetsReady, setAssetsReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [result, setResult] = useState<{ xpGained: number; level: number } | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const m = dict.minigame;

  // 마운트 시점에 한 번 고정 → 진행 중인 판은 설정이 바뀌어도 흔들리지 않고, 다시 들어와야 반영된다
  // ("설정값은 게임 재시작 시 반영" FR-10.2).
  const [cfg] = useState<MinigameConfig>(() => config ?? DEFAULT_CONFIG);

  // 에셋 선로딩 — 첫 물체가 떨어질 때 깜빡이지 않도록 시작 버튼을 이때까지 잠근다.
  // 개별 SVG(위성 등) + 줍스 캐릭터 시트(내 색 1장, PR #19 에셋).
  useEffect(() => {
    let cancelled = false;
    const map = imagesRef.current;
    const sources: [string, string][] = [
      ...ALL_ITEMS.filter((it) => it.asset).map((it) => [it.id, it.asset!] as [string, string]),
      ["joop-sheet", joopSheetPath(sheetForColor(color))],
      ["debris-sheet", DEBRIS_SHEET],
    ];
    let remaining = sources.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0 && !cancelled) setAssetsReady(true);
    };
    for (const [id, src] of sources) {
      const img = new Image();
      img.onload = done;
      img.onerror = done; // 하나 실패해도 훈련은 시작할 수 있어야 한다(대체 도형으로 그린다)
      img.src = src;
      map.set(id, img);
    }
    return () => {
      cancelled = true;
    };
  }, [color]);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 모션 최소화(OS 설정): 판단 단서(경고등·붉은 외곽선)는 유지하되 장식 모션만 끈다.
    // 낙하 자체는 게임의 본질이라 끌 수 없다 — 흔들림·깜빡임 같은 부가 모션만 줄인다.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const styles = getComputedStyle(document.documentElement);
    const pick = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback;
    const gridColor = pick("--color-grid", "#1e5a46");
    const amber = pick("--color-secondary", "#ffb23e");
    const fgColor = pick("--color-fg", "#e4f2e9");
    const mutedColor = pick("--color-muted", "#7d8f99");
    const dangerColor = pick("--color-danger", "#ff5c77");
    const surface = pick("--color-surface", "#0f1826");
    const bezel = "#26374a";

    let raf = 0;
    let running = true;

    // ── 월드 크기(CSS px) — devicePixelRatio 대응
    // ⚠️ 크기는 **컨테이너**에서 잰다. canvas 자신을 재면 width/height 속성을 다시 쓰는 순간
    //    고유 크기가 바뀌어 관측 → 확대 → 관측이 반복되는 되먹임(탭 크래시)이 생긴다.
    let W = 0;
    let H = 0;
    const resize = () => {
      const box = boxRef.current;
      if (!box) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = box.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    // 레이아웃이 확정되는 시점이 첫 프레임보다 늦을 수 있어 ResizeObserver 로 따라간다.
    // (window resize 만 듣던 예전 코드는 한 번 잘못 잰 크기를 끝까지 들고 갔다.)
    const observer = new ResizeObserver(resize);
    if (boxRef.current) observer.observe(boxRef.current);
    window.addEventListener("resize", resize);

    const unit = () => Math.min(W, H);
    const groundY = () => H * 0.87; // 땅의 윗면 — 줍스의 발이 여기 닿는다

    // ── 줍스(플레이어)
    const joop = { x: 0.5, vx: 0, joy: 0, hurt: 0, blink: 0 }; // x = 0~1 정규화
    let targetX: number | null = null; // 포인터로 지정한 목표 위치(0~1)
    let keyDir = 0; // -1 | 0 | 1

    const joopSize = () => {
      const u = unit();
      return { w: u * 0.15, h: u * 0.19 };
    };

    // ── 떨어지는 물체
    type Falling = {
      item: FallingItem;
      x: number;
      y: number;
      w: number;
      h: number;
      vy: number;
      rot: number;
      rotV: number;
    };
    const falling: Falling[] = [];
    type Floater = { x: number; y: number; text: string; color: string; life: number };
    const floaters: Floater[] = [];

    let elapsed = 0;
    let spawnTimer = 1.1; // 시작 직후 1.1초는 여유 — 화면을 파악할 시간
    let caught = 0;
    let missed = 0;
    let hits = 0;
    // 연속 수거(streak) — 0.9초 안에 이어 잡으면 음이 반음씩 올라간다
    let streak = 0;
    let lastCatchAt = -Infinity;
    let lastWarnSec = -1;

    const spawn = () => {
      const item = pickItem(cfg, Math.random(), Math.random());
      const img = imagesRef.current.get(item.id);
      const u = unit();
      const h = u * item.scale;
      // 시트 프레임은 정사각(64), 단일 에셋은 고유 종횡비 유지
      const ratio =
        item.sheetFrame == null && img && img.naturalWidth > 0 && img.naturalHeight > 0
          ? img.naturalWidth / img.naturalHeight
          : 1;
      const w = h * ratio;
      const half = w / 2;
      const spanMin = Math.min(half + 6, W / 2);
      const spanMax = Math.max(W - half - 6, W / 2);
      // 위성은 크고 무겁게, 쓰레기는 가볍게 — 회전으로도 실루엣을 구분하게 한다.
      const speed = fallSpeedAt(cfg, elapsed) * H * (item.hazard ? 0.88 : 1) * (0.9 + Math.random() * 0.25);
      falling.push({
        item,
        x: spanMin + Math.random() * (spanMax - spanMin),
        y: -h,
        w,
        h,
        vy: speed,
        rot: (Math.random() - 0.5) * 0.6,
        rotV: item.hazard ? (Math.random() - 0.5) * 0.25 : (Math.random() - 0.5) * 1.6,
      });
    };

    // ── 입력
    const localX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    };
    const onDown = (e: PointerEvent) => {
      targetX = localX(e.clientX);
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons > 0 || e.pointerType === "touch") targetX = localX(e.clientX);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keyDir = -1;
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keyDir = 1;
      else return;
      targetX = null;
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (["ArrowLeft", "a", "A"].includes(e.key) && keyDir === -1) keyDir = 0;
      if (["ArrowRight", "d", "D"].includes(e.key) && keyDir === 1) keyDir = 0;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const endGame = (reason: Summary["reason"]) => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      sfx.stopAll();
      if (reason === "broken") sfx.gndLose();
      else sfx.gndWin();
      setSummary({ caught, missed, hits, bond: bondFrom(caught, hits), reason });
      setPhase("over");
    };

    // ── 그리기 유틸
    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    };

    // 줍스 폴백 — 시트 로드 실패 시 쓰는 도형 렌더(기존 구현 보존).
    // 눌린 색(color)이 액센트, 앰버 비콘은 브랜드 고정.
    const drawJoopFallback = (cx: number, feetY: number, w: number, h: number) => {
      const shake = !reduceMotion && joop.hurt > 0 ? Math.sin(joop.hurt * 60) * w * 0.06 : 0;
      const x = cx + shake;
      const bodyH = h * 0.62;
      const bodyW = w * 0.78;
      const bodyY = feetY - h * 0.16 - bodyH;

      // 접지 글로우
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, feetY - 2, w * 0.5, h * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // 안테나 + 비콘
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, w * 0.045);
      ctx.beginPath();
      ctx.moveTo(x, bodyY);
      ctx.lineTo(x, bodyY - h * 0.13);
      ctx.stroke();
      ctx.fillStyle = amber;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(x, bodyY - h * 0.15, Math.max(2.5, w * 0.055), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // 수거 바스켓(양팔) — 받아내는 부위임을 시각적으로 알린다
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, w * 0.055);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x, bodyY + h * 0.02, bodyW * 0.62, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 몸통
      ctx.fillStyle = surface;
      ctx.strokeStyle = joop.hurt > 0 ? dangerColor : bezel;
      ctx.lineWidth = Math.max(1.5, w * 0.03);
      roundRect(x - bodyW / 2, bodyY, bodyW, bodyH, w * 0.14);
      ctx.fill();
      ctx.stroke();

      // 바이저
      const vW = bodyW * 0.72;
      const vH = bodyH * 0.38;
      const vX = x - vW / 2;
      const vY = bodyY + bodyH * 0.16;
      ctx.fillStyle = "#0b1220";
      roundRect(vX, vY, vW, vH, vH * 0.4);
      ctx.fill();

      // 눈 — 이동 방향으로 살짝 쏠리고, 받아내면 웃고, 부딪히면 찡그린다
      const look = Math.max(-1, Math.min(1, joop.vx * 2.5)) * vW * 0.1;
      const eyeR = vH * 0.22;
      const eyeY = vY + vH / 2;
      const eyeDx = vW * 0.22;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      const blinking = joop.blink > 0 && joop.blink < 0.12;
      for (const s of [-1, 1]) {
        const ex = x + s * eyeDx + look;
        if (joop.hurt > 0) {
          // ×  눈
          ctx.lineWidth = Math.max(1.5, eyeR * 0.5);
          ctx.strokeStyle = dangerColor;
          ctx.beginPath();
          ctx.moveTo(ex - eyeR, eyeY - eyeR);
          ctx.lineTo(ex + eyeR, eyeY + eyeR);
          ctx.moveTo(ex + eyeR, eyeY - eyeR);
          ctx.lineTo(ex - eyeR, eyeY + eyeR);
          ctx.stroke();
        } else if (joop.joy > 0) {
          // ^ 눈
          ctx.lineWidth = Math.max(1.5, eyeR * 0.55);
          ctx.beginPath();
          ctx.arc(ex, eyeY + eyeR * 0.5, eyeR, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        } else if (blinking) {
          ctx.lineWidth = Math.max(1.5, eyeR * 0.5);
          ctx.beginPath();
          ctx.moveTo(ex - eyeR, eyeY);
          ctx.lineTo(ex + eyeR, eyeY);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;

      // 가슴 액센트 스트라이프
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x - bodyW * 0.22, bodyY + bodyH * 0.68, bodyW * 0.44, bodyH * 0.08);
      ctx.globalAlpha = 1;

      // 무한궤도
      const tH = h * 0.16;
      const tY = feetY - tH;
      ctx.fillStyle = "#16202e";
      ctx.strokeStyle = bezel;
      ctx.lineWidth = Math.max(1.5, w * 0.03);
      roundRect(x - w / 2, tY, w, tH, tH * 0.45);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = bezel;
      for (const s of [-1, 0, 1]) {
        ctx.beginPath();
        ctx.arc(x + s * w * 0.3, tY + tH / 2, tH * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // 줍스 — 캐릭터 스프라이트 시트(6프레임, PR #19). 상태 머신은 기존 값 재사용:
    // joy>0 → collect(트랙터 빔) / 이동 중 → move(분사) / 그 외 idle(깜빡임).
    // 피격(hurt)은 시트에 프레임이 없어 기존 연출(셰이크 + danger 글로우)을 유지한다.
    const drawJoop = (cx: number, feetY: number, w: number, h: number) => {
      const sheet = imagesRef.current.get("joop-sheet");
      if (!sheet || !sheet.complete || sheet.naturalWidth === 0) {
        drawJoopFallback(cx, feetY, w, h);
        return;
      }
      const shake = !reduceMotion && joop.hurt > 0 ? Math.sin(joop.hurt * 60) * w * 0.06 : 0;
      const x = cx + shake;

      // 접지 글로우(기존 유지) — 캐릭터가 땅에 붙어 있음을 강조
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, feetY - 2, w * 0.5, h * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      const moving = Math.abs(joop.vx) > 0.05;
      const state: JoopSpriteState = joop.joy > 0 ? "collect" : moving ? "move" : "idle";
      const f = spriteFrame(state, elapsed, reduceMotion);

      // 프레임 발 위치(JOOP_FEET_Y)를 땅(feetY)에 맞추고, 캐릭터 실높이 ≈ h 로 스케일
      const dh = (h * JOOP_FRAME) / JOOP_FEET_Y;
      const dw = dh; // 프레임은 정사각
      const dy = feetY - h;

      ctx.save();
      if (joop.hurt > 0) {
        ctx.shadowColor = dangerColor;
        ctx.shadowBlur = 14;
      }
      // 왼쪽 이동 시 좌우 반전(시트의 move 프레임은 한 방향)
      if (state === "move" && joop.vx < 0) {
        ctx.translate(x, 0);
        ctx.scale(-1, 1);
        ctx.translate(-x, 0);
      }
      ctx.drawImage(sheet, f * JOOP_FRAME, 0, JOOP_FRAME, JOOP_FRAME, x - dw / 2, dy, dw, dh);
      ctx.restore();
    };

    const drawItem = (f: Falling) => {
      const img = imagesRef.current.get(f.item.id);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      // 위험물은 붉은 기운, 쓰레기는 앰버 기운 — 실루엣만으로 판단하기 어려운 순간의 단서.
      ctx.shadowColor = f.item.hazard ? dangerColor : amber;
      ctx.shadowBlur = f.item.hazard ? 16 : 8;
      const sheet = f.item.sheetFrame != null ? imagesRef.current.get("debris-sheet") : undefined;
      if (sheet && sheet.complete && sheet.naturalWidth > 0 && f.item.sheetFrame != null) {
        // 쓰레기 시트(PR #19) 프레임 슬라이스
        ctx.drawImage(
          sheet,
          f.item.sheetFrame * DEBRIS_FRAME,
          0,
          DEBRIS_FRAME,
          DEBRIS_FRAME,
          -f.w / 2,
          -f.h / 2,
          f.w,
          f.h,
        );
      } else if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -f.w / 2, -f.h / 2, f.w, f.h);
      } else {
        // 에셋 로딩 실패 폴백
        ctx.fillStyle = f.item.hazard ? dangerColor : amber;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
        ctx.globalAlpha = 1;
      }
      ctx.shadowBlur = 0;
      ctx.restore();

      // 작동 중인 위성 표시 — 경고등 + 점선 링.
      // 점선 링은 색각과 무관한 형태 단서다(붉은 기운만으로는 색약 사용자가 구분하기 어렵다).
      // 시작 브리핑의 "피하기" 상자 테두리도 같은 점선이라 단서가 이어진다.
      if (f.item.hazard) {
        const blink = reduceMotion ? 1 : 0.35 + 0.65 * Math.abs(Math.sin(elapsed * 6));
        ctx.globalAlpha = blink;
        ctx.fillStyle = dangerColor;
        ctx.beginPath();
        ctx.arc(f.x, f.y - f.h * 0.5 - 6, Math.max(2, f.h * 0.06), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.save();
        ctx.strokeStyle = dangerColor;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(f.x, f.y, Math.max(f.w, f.h) * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    };

    // ── 루프
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); // 탭 복귀 시 점프 방지
      last = now;

      if (W < 2 || H < 2) {
        if (running) raf = requestAnimationFrame(frame);
        return;
      }
      const u = unit();
      const gY = groundY();
      const size = joopSize();

      elapsed += dt;
      const remain = Math.max(0, cfg.duration - elapsed);

      // ── 이동: 키 입력이 있으면 키 우선, 없으면 포인터 목표로 접근
      const speedPx = cfg.moveSpeed * W * dt;
      const prevX = joop.x;
      if (keyDir !== 0) {
        joop.x += (keyDir * speedPx) / W;
      } else if (targetX !== null) {
        const d = targetX - joop.x;
        const step = speedPx / W;
        joop.x += Math.abs(d) <= step ? d : Math.sign(d) * step;
      }
      const marginX = size.w / 2 / W;
      joop.x = Math.max(marginX, Math.min(1 - marginX, joop.x));
      joop.vx = (joop.x - prevX) / Math.max(dt, 0.001);

      joop.joy = Math.max(0, joop.joy - dt);
      joop.hurt = Math.max(0, joop.hurt - dt);
      joop.blink = reduceMotion
        ? 0
        : joop.blink > 0
          ? joop.blink - dt
          : Math.random() < dt * 0.35
            ? 0.24
            : 0;

      // ── 생성
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawn();
        spawnTimer = spawnIntervalAt(cfg, elapsed);
      }

      // ── 물체 이동 · 충돌
      const jx = joop.x * W;
      const boxL = jx - size.w * 0.46;
      const boxR = jx + size.w * 0.46;
      const boxT = gY - size.h;
      const boxB = gY;

      for (let i = falling.length - 1; i >= 0; i--) {
        const f = falling[i];
        f.y += f.vy * dt;
        f.rot += f.rotV * dt;

        // 원(물체) ↔ 사각형(줍스) 충돌
        const r = Math.min(f.w, f.h) * 0.4;
        const nx = Math.max(boxL, Math.min(f.x, boxR));
        const ny = Math.max(boxT, Math.min(f.y, boxB));
        if (Math.hypot(f.x - nx, f.y - ny) < r) {
          if (f.item.hazard) {
            hits += 1;
            joop.hurt = 0.55;
            joop.joy = 0;
            streak = 0;
            sfx.gndHit();
            floaters.push({ x: f.x, y: f.y, text: "!", color: dangerColor, life: 0.9 });
          } else {
            caught += 1;
            joop.joy = 0.5;
            streak = elapsed - lastCatchAt <= 0.9 ? streak + 1 : 0;
            lastCatchAt = elapsed;
            sfx.gndCollect(streak);
            floaters.push({ x: f.x, y: f.y, text: "+1", color: color, life: 0.9 });
          }
          falling.splice(i, 1);
          if (hits >= cfg.lives) {
            endGame("broken");
            return;
          }
          continue;
        }

        // 땅에 닿음
        if (f.y - r > gY) {
          if (!f.item.hazard) {
            missed += 1;
            streak = 0;
            sfx.gndMiss();
          }
          falling.splice(i, 1);
        }
      }

      // ── 렌더
      ctx.clearRect(0, 0, W, H);

      // 배경 그리드(하늘 영역)
      ctx.strokeStyle = gridColor;
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = 1;
      const gs = u * 0.14;
      for (let gx = 0; gx < W; gx += gs) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, gY);
        ctx.stroke();
      }
      for (let gy = 0; gy < gY; gy += gs) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 땅
      ctx.fillStyle = surface;
      ctx.fillRect(0, gY, W, H - gY);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, gY);
      ctx.lineTo(W, gY);
      ctx.stroke();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      for (let gx = (u * 0.07) / 2; gx < W; gx += u * 0.07) {
        ctx.beginPath();
        ctx.moveTo(gx, gY + 4);
        ctx.lineTo(gx - u * 0.03, H);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (const f of falling) drawItem(f);
      drawJoop(jx, gY, size.w, size.h);

      // 플로터(+1 / !)
      for (let i = floaters.length - 1; i >= 0; i--) {
        const fl = floaters[i];
        fl.life -= dt;
        fl.y -= dt * u * 0.35;
        if (fl.life <= 0) {
          floaters.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.min(1, fl.life * 1.6);
        ctx.fillStyle = fl.color;
        ctx.font = `600 ${Math.round(u * 0.05)}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(fl.text, fl.x, fl.y);
        ctx.globalAlpha = 1;
      }
      ctx.textAlign = "left";

      // ── HUD
      const pad = 12;
      const fs = Math.max(11, Math.round(u * 0.038));
      ctx.font = `${fs}px ui-monospace, monospace`;
      ctx.textBaseline = "top";
      ctx.fillStyle = fgColor;
      ctx.fillText(`${m.score} ${caught}`, pad, pad);
      ctx.textAlign = "right";
      if (remain <= 10 && Math.ceil(remain) !== lastWarnSec) {
        lastWarnSec = Math.ceil(remain);
        sfx.gndWarnTick();
      }
      ctx.fillStyle = remain <= 10 ? amber : mutedColor;
      ctx.fillText(`${m.time} ${Math.ceil(remain)}s`, W - pad, pad);
      ctx.textAlign = "left";

      // 유대 바
      const bond = bondFrom(caught, hits);
      const barY = pad + fs + 10;
      const barW = W * 0.38;
      ctx.fillStyle = mutedColor;
      ctx.font = `${Math.max(9, Math.round(fs * 0.75))}px ui-monospace, monospace`;
      ctx.fillText(m.bond, pad, barY - 1);
      const labelW = ctx.measureText(m.bond).width + 6;
      ctx.fillStyle = gridColor;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(pad + labelW, barY + 1, barW, 6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(pad + labelW, barY + 1, barW * (bond / 100), 6);

      // 내구도
      const livesLeft = Math.max(0, cfg.lives - hits);
      const box = Math.max(6, u * 0.022);
      for (let i = 0; i < cfg.lives; i++) {
        const bx = W - pad - (i + 1) * (box + 5);
        ctx.fillStyle = i < livesLeft ? color : gridColor;
        ctx.globalAlpha = i < livesLeft ? 1 : 0.45;
        roundRect(bx, barY, box, box, 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (remain <= 0) {
        endGame("time");
        return;
      }
      if (running) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      sfx.stopAll();
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
    };
    // cfg 는 useState 초기화로 고정된 참조라 게임 루프를 재시작시키지 않는다.
  }, [phase, cfg, color, m]);

  const saveResult = useCallback(async () => {
    if (!summary) return;
    setPhase("saving");
    setSaveError(null);
    // 실패를 조용히 삼키면 사용자는 한 판을 통째로 잃고도 이유를 모른다.
    // 문구를 보여주고 결과 화면(over)에 남겨 재시도할 수 있게 한다.
    try {
      const res = await submitMinigameResult(summary.caught);
      if (res.ok) {
        trackMinigameCompleted(res.xpGained, res.level, res.xp);
        sfx.gndSaved();
        setResult({ xpGained: res.xpGained, level: res.level });
        setPhase("saved");
      } else {
        setSaveError(res.error);
        setPhase("over");
      }
    } catch {
      setSaveError("network");
      setPhase("over");
    }
  }, [summary]);

  const retry = () => {
    setSummary(null);
    setResult(null);
    setSaveError(null);
    setPhase("ready");
  };

  const overlayClass =
    "absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] px-6 text-center";
  const buttonStyle = { background: "var(--color-primary)", color: "var(--color-bg)" } as const;
  const buttonClass =
    "rounded-md px-6 py-2.5 font-mono text-sm font-semibold uppercase tracking-widest disabled:opacity-60";

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        ref={boxRef}
        className="game-surface relative mx-3 mb-1 flex-1 overflow-hidden rounded-md border"
        style={{ borderColor: "var(--color-neutral-600)" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* absolute + inset-0 + 100% 크기로 컨테이너를 꽉 채운다. 예전처럼 흐름 배치 + h-full
            만 주면 canvas 의 고유 종횡비가 이겨서 화면 위쪽 일부만 게임 화면이 되어 버렸다. */}
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" />

        {phase === "playing" && (
          <button
            type="button"
            onClick={() => {
              sfx.stopAll();
              router.push(`/${lang}/joop`);
            }}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md border px-3 py-1 font-mono text-[10px] uppercase tracking-widest"
            style={{
              borderColor: "var(--color-neutral-600)",
              background: "color-mix(in srgb, var(--color-bg) 70%, transparent)",
              color: "var(--color-muted)",
            }}
          >
            {m.quit}
          </button>
        )}

        {phase === "ready" && (
          <div className={overlayClass}>
            {/* 훈련 주인공 — 내 줍스 (idle 애니메이션, reduced-motion 시 정지) */}
            <JoopSprite color={color} size={96} />
            <h2 className="font-mono text-base font-semibold text-[var(--color-primary)]">
              {m.briefTitle}
            </h2>
            <p className="max-w-xs font-mono text-xs leading-relaxed text-[var(--color-fg)]">
              {m.briefBody}
            </p>

            <div className="flex w-full max-w-xs flex-col gap-3">
              <ItemRow label={m.safeLabel} items={SAFE_ITEMS.slice(0, 4)} accent="var(--color-secondary)" />
              {/* 점선 테두리 = 게임 화면에서 위험물을 감싸는 점선 링과 같은 단서 */}
              <ItemRow label={m.hazardLabel} items={HAZARD_ITEMS} accent="var(--color-danger)" dashed />
            </div>

            <p className="font-mono text-[11px] leading-relaxed text-[var(--color-muted)]">
              {m.hint}
              <br />
              {m.rules
                .replace("{lives}", String(cfg.lives))
                .replace("{seconds}", String(cfg.duration))}
            </p>

            <button
              onClick={() => {
                sfx.unlockAudio(); // 이 클릭이 오디오 언락 제스처(언락 3중 방어 3선)
                sfx.gndStart();
                setPhase("playing");
              }}
              disabled={!assetsReady}
              className={buttonClass}
              style={buttonStyle}
            >
              {assetsReady ? m.start : m.loading}
            </button>
          </div>
        )}

        {(phase === "over" || phase === "saving" || phase === "saved") && summary && (
          <div className={overlayClass}>
            <h2 className="font-mono text-lg font-semibold text-[var(--color-primary)]">
              {m.gameOver}
            </h2>
            <p className="font-mono text-xs text-[var(--color-muted)]">
              {summary.reason === "broken" ? m.reasonBroken : m.reasonTime}
            </p>

            <dl className="grid w-full max-w-xs grid-cols-3 gap-2 font-mono text-xs">
              <Stat label={m.collected} value={summary.caught} tone="var(--color-primary)" />
              <Stat label={m.missed} value={summary.missed} tone="var(--color-muted)" />
              <Stat
                label={m.hit}
                value={summary.hits}
                tone={summary.hits > 0 ? "var(--color-danger)" : "var(--color-muted)"}
              />
            </dl>

            <div className="w-full max-w-xs">
              <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-widest text-[var(--color-muted)]">
                <span>{m.bond}</span>
                <span className="text-[var(--color-fg)]">{m.bondTier[bondTier(summary.bond)]}</span>
              </div>
              <div
                className="mt-1 h-2 w-full overflow-hidden rounded-full"
                style={{ background: "var(--color-neutral-700)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${summary.bond}%`,
                    background: "var(--color-primary)",
                    boxShadow: "var(--glow-primary)",
                  }}
                />
              </div>
            </div>

            {phase === "saved" && result ? (
              <>
                <p className="font-mono text-sm text-[var(--color-primary)]">
                  +{result.xpGained} XP · {m.nowLevel} {result.level}
                </p>
                <div className="flex gap-2">
                  <button onClick={retry} className={`${buttonClass} border bg-transparent`} style={{ borderColor: "var(--color-neutral-600)", color: "var(--color-fg)" }}>
                    {m.retry}
                  </button>
                  <button
                    onClick={() => router.push(`/${lang}/joop`)}
                    className={buttonClass}
                    style={buttonStyle}
                  >
                    {m.toDashboard}
                  </button>
                </div>
              </>
            ) : (
              <>
                {saveError && (
                  <p
                    role="alert"
                    className="font-mono text-xs text-[var(--color-danger)]"
                  >
                    {m.saveError} <span className="opacity-60">({saveError})</span>
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={retry}
                    disabled={phase === "saving"}
                    className={`${buttonClass} border bg-transparent`}
                    style={{ borderColor: "var(--color-neutral-600)", color: "var(--color-fg)" }}
                  >
                    {m.retry}
                  </button>
                  <button
                    onClick={saveResult}
                    disabled={phase === "saving"}
                    className={buttonClass}
                    style={buttonStyle}
                  >
                    {phase === "saving" ? m.saving : m.save}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 시작 브리핑의 "받아낼 것 / 피할 것" 아이콘 줄 — 식별 훈련의 정답표. */
function ItemRow({
  label,
  items,
  accent,
  dashed = false,
}: {
  label: string;
  items: readonly FallingItem[];
  accent: string;
  dashed?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-2.5 py-2"
      style={{
        borderColor: accent,
        borderStyle: dashed ? "dashed" : "solid",
        background: "color-mix(in srgb, var(--color-surface) 70%, transparent)",
      }}
    >
      <span
        className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-widest"
        style={{ color: accent }}
      >
        {label}
      </span>
      <span className="flex flex-1 items-center justify-end gap-2">
        {items.map((it) =>
          it.sheetFrame != null ? (
            // 쓰레기 시트 프레임 크롭 — 캔버스와 같은 그림을 정답표에도 쓴다
            <span
              key={it.id}
              aria-hidden
              className="inline-block h-6 w-6"
              style={{
                backgroundImage: `url(${DEBRIS_SHEET})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: "600% 100%",
                backgroundPosition: `${it.sheetFrame * 20}% 0`,
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- 캔버스와 같은 SVG를 그대로 쓴다(최적화 불필요)
            <img key={it.id} src={it.asset} alt="" aria-hidden className="h-6 w-auto" />
          ),
        )}
      </span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div
      className="rounded-md border px-2 py-1.5"
      style={{ borderColor: "var(--color-neutral-600)" }}
    >
      <dt className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold" style={{ color: tone }}>
        {value}
      </dd>
    </div>
  );
}
