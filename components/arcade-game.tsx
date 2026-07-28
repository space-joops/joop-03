"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ARCADE_FUEL_ITEM,
  CELESTIALS,
  GALAXY_TILE,
  sunTintAlpha,
  DEFAULT_ARCADE_CONFIG,
  applyThrust,
  collides,
  joystickInput,
  pickArcadeItem,
  starHash,
  type ArcadeConfig,
  type ArcadeItem,
  type Vec,
} from "@/lib/arcade";
import { DEBRIS_SHEET, DEBRIS_FRAME } from "@/lib/minigame";
import { JOOP_FRAME, joopSheetPath, sheetForColor, spriteFrame } from "@/lib/joop-sprite";
import { payShadowEntry, submitArcadeResult } from "@/app/[lang]/joop/arcade/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

type Phase = "ready" | "playing" | "over" | "saving" | "saved";

// 조이스틱 바깥 링 반지름(화면 최소변 비율). 0.17 → 0.24 로 확대해 5단계 미세 조정이 쉽게.
const JOYSTICK_R = 0.24;

// 별 색온도 팔레트(웜화이트/백/청/주황) — 은하 마스터의 별밭과 같은 분포(가중치 4:3:2:1).
const STAR_COLORS = [
  "#fff3e4", "#fff3e4", "#fff3e4", "#fff3e4",
  "#f4f7ff", "#f4f7ff", "#f4f7ff",
  "#cfe0ff", "#cfe0ff",
  "#ffd9a8",
] as const;

// 아케이드(우주 수거, M5 / EPIC 7) — 수신 지역에서 진입하는 본편 게임.
// 조작(FR-7.4): 화면 아무 곳이나 누르면 그 자리에 5원 반투명 조이스틱.
//   드래그 방향 = 분사 방향, 링 단계(1~5) = 분사량 0.2~1.0 미세 조정.
// 물리(FR-7.5): 관성 있음 · 마찰 0(lib/arcade.ts, 관리자 설정 주입).
// 연료(FR-7.6): 분사에만 소모, 소진 후 관성으로 연료 아이템을 주우면 회생.
// 배경(FR-7.2): 개방 월드 — 카메라가 줍스를 따라가고 별·천체가 패럴랙스로 흐른다.
export type ShadowGate = {
  inShadow: boolean;
  /** 음영 진입에 청구할 XP(0 = 무료) */
  cost: number;
  xp: number;
  /** 수신 복귀 예정 시각(epoch ms) */
  nextChangeAt: number;
  /** 서버 렌더 시각(epoch ms) — 첫 렌더를 결정적으로 만들어 하이드레이션 불일치를 막는다 */
  serverNow: number;
};

export function ArcadeGame({
  lang,
  dict,
  color,
  name,
  config,
  shadowGate,
}: {
  lang: Locale;
  dict: Dictionary;
  color: string;
  name: string;
  config?: ArcadeConfig;
  /** 음영 게이트 — 없으면 항상 열린 것으로 본다(하네스·테스트용) */
  shadowGate?: ShadowGate;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ready");
  const [assetsReady, setAssetsReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ collected: number; eaten: number } | null>(null);
  const [result, setResult] = useState<{ collected: number; total: number } | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const a = dict.arcade;

  // 진입 시점 설정 고정 — "게임 재시작 시 반영"(FR-10.2/FR-7.5)
  const [cfg] = useState<ArcadeConfig>(() => config ?? DEFAULT_ARCADE_CONFIG);

  // 게임 루프의 endGame 을 DOM 버튼(조기 종료)에서 부르기 위한 다리
  const endGameRef = useRef<() => void>(() => {});

  // ── 음영 게이트(초기 개발 단계: XP 를 내면 음영에서도 플레이)
  const needsPay = !!shadowGate && shadowGate.inShadow && shadowGate.cost > 0;
  const [paid, setPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [xpLeft, setXpLeft] = useState(shadowGate?.xp ?? 0);

  // 수신 복귀까지 남은 시간(음영일 때만) — 기다릴지 지불할지 판단할 근거를 준다.
  // 첫 렌더는 서버 시각 기준(결정적), 이후 0.5초마다 실제 시각으로 갱신.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    if (!shadowGate?.inShadow) return;
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, [shadowGate?.inShadow]);
  const waitSec = shadowGate
    ? Math.max(0, Math.ceil((shadowGate.nextChangeAt - (nowMs ?? shadowGate.serverNow)) / 1000))
    : 0;

  const payAndStart = useCallback(async () => {
    setPaying(true);
    setPayError(null);
    try {
      const res = await payShadowEntry();
      if (res.ok) {
        setXpLeft(res.xpLeft);
        setPaid(true);
        setPhase("playing");
      } else {
        setPayError(res.error);
      }
    } catch {
      setPayError("network");
    } finally {
      setPaying(false);
    }
  }, []);

  // 에셋 선로딩 — 쓰레기 시트 + 줍스 시트(내 색) + 연료 + 배경 천체.
  useEffect(() => {
    let cancelled = false;
    const map = imagesRef.current;
    const sources = new Map<string, string>([
      ["debris-sheet", DEBRIS_SHEET],
      ["joop-sheet", joopSheetPath(sheetForColor(color))],
      ["fuel", ARCADE_FUEL_ITEM.asset!],
      [GALAXY_TILE.asset, GALAXY_TILE.asset],
      ...CELESTIALS.map((c) => [c.asset, c.asset] as [string, string]),
    ]);
    let remaining = sources.size;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0 && !cancelled) setAssetsReady(true);
    };
    for (const [id, src] of sources) {
      const img = new Image();
      img.onload = done;
      img.onerror = done; // 실패해도 대체 도형으로 진행
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

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const styles = getComputedStyle(document.documentElement);
    const pick = (n: string, fb: string) => styles.getPropertyValue(n).trim() || fb;
    const gridColor = pick("--color-grid", "#1e5a46");
    const amber = pick("--color-secondary", "#ffb23e");
    const fgColor = pick("--color-fg", "#e4f2e9");
    const mutedColor = pick("--color-muted", "#8a9e92");
    const dangerColor = pick("--color-danger", "#ff5c77");
    const accent = pick("--color-accent", "#38e0f0");

    let raf = 0;
    let running = true;

    // 크기는 컨테이너에서 잰다(캔버스 자신을 재면 되먹임 — 지상 훈련 워크로그 참고).
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
    const observer = new ResizeObserver(resize);
    if (boxRef.current) observer.observe(boxRef.current);
    window.addEventListener("resize", resize);

    const unit = () => Math.min(W, H); // 월드 1.0 = 화면 최소변

    // ── 상태
    const joop = { pos: { x: 0, y: 0 } as Vec, vel: { x: 0, y: 0 } as Vec, collectFx: 0 };
    const JOOP_RADIUS = 0.065; // 월드 단위(수거 판정)
    let fuel = cfg.fuel;
    let emptySince: number | null = null; // 연료 0 이 된 경과시각(회생 허용)
    let collected = 0; // 조각(디브리 value 합)
    let eaten = 0; // 개수
    let elapsed = 0;
    let spawnTimer = 0.8;

    // 조이스틱(FR-7.4)
    type Stick = { baseX: number; baseY: number; dx: number; dy: number; pointerId: number };
    let stick: Stick | null = null;
    const keys = new Set<string>();

    type Floating = { item: ArcadeItem; pos: Vec; vel: Vec; rot: number; rotV: number };
    const items: Floating[] = [];
    type Floater = { pos: Vec; text: string; color: string; life: number };
    const floaters: Floater[] = [];

    // 분사가스 파티클(handoff-m5 §3): r5→11px·불투명 .35→.08·수명 600ms·초당 12×세기·상한 60.
    // 색은 분사 세기 따라 시안(저출력) → 앰버(중간) → 백열(풀출력).
    type Exhaust = { pos: Vec; vel: Vec; age: number; color: string };
    const exhaust: Exhaust[] = [];
    let exhaustAcc = 0;
    const flameColor = (s: number) => (s <= 0.4 ? accent : s <= 0.8 ? amber : "#ffe9c4");

    const toScreen = (p: Vec) => ({
      x: W / 2 + (p.x - joop.pos.x) * unit(),
      y: H / 2 + (p.y - joop.pos.y) * unit(),
    });

    // 뷰포트 가장자리 밖에서 진입, 표류하며 가로지른다(FR-7.3: 상하좌우 등장)
    const spawn = () => {
      const u = unit();
      const halfW = W / 2 / u + 0.1;
      const halfH = H / 2 / u + 0.1;
      const item = pickArcadeItem(cfg, Math.random(), Math.random());
      const edge = Math.floor(Math.random() * 4); // 0상 1하 2좌 3우
      const along = Math.random() * 2 - 1;
      const pos: Vec =
        edge === 0
          ? { x: joop.pos.x + along * halfW, y: joop.pos.y - halfH }
          : edge === 1
            ? { x: joop.pos.x + along * halfW, y: joop.pos.y + halfH }
            : edge === 2
              ? { x: joop.pos.x - halfW, y: joop.pos.y + along * halfH }
              : { x: joop.pos.x + halfW, y: joop.pos.y + along * halfH };
      // 뷰 안쪽의 임의 지점을 향해 표류 — 반드시 화면을 가로지른다
      const target: Vec = {
        x: joop.pos.x + (Math.random() * 2 - 1) * halfW * 0.6,
        y: joop.pos.y + (Math.random() * 2 - 1) * halfH * 0.6,
      };
      const d = Math.hypot(target.x - pos.x, target.y - pos.y) || 1;
      const speed = 0.05 + Math.random() * 0.13;
      items.push({
        item,
        pos,
        vel: { x: ((target.x - pos.x) / d) * speed, y: ((target.y - pos.y) / d) * speed },
        rot: Math.random() * Math.PI * 2,
        rotV: reduceMotion ? 0 : (Math.random() - 0.5) * 1.05, // meta: -30~+30 deg/s
      });
    };

    // ── 입력
    const localXY = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      const p = localXY(e);
      stick = { baseX: p.x, baseY: p.y, dx: 0, dy: 0, pointerId: e.pointerId };
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!stick || e.pointerId !== stick.pointerId) return;
      const p = localXY(e);
      stick.dx = p.x - stick.baseX;
      stick.dy = p.y - stick.baseY;
    };
    const releaseStick = (e: PointerEvent) => {
      if (stick && e.pointerId === stick.pointerId) {
        stick = null;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          // 이미 해제됐으면 무시
        }
      }
    };
    const KEYS: Record<string, Vec> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 },
      s: { x: 0, y: 1 },
      a: { x: -1, y: 0 },
      d: { x: 1, y: 0 },
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!(k in KEYS)) return;
      keys.add(k);
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", releaseStick);
    canvas.addEventListener("pointercancel", releaseStick);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const endGame = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      setSummary({ collected, eaten });
      setPhase("over");
    };
    // 조기 종료 버튼(DOM)이 호출할 수 있게 ref 로 노출
    endGameRef.current = endGame;

    // ── 그리기
    const drawBackground = (u: number) => {
      // 딥스페이스 — 실사 톤은 칠흑에 가깝다(색감은 은하 타일이 담당)
      ctx.fillStyle = "#010208";
      ctx.fillRect(0, 0, W, H);

      // 최원경 은하 타일(handoff-m5 §1) — 수평 반복, 스크롤 계수 0.1
      const gimg = imagesRef.current.get(GALAXY_TILE.asset);
      if (gimg && gimg.complete && gimg.naturalWidth > 0) {
        const th = GALAXY_TILE.height * u;
        const tw = th * (gimg.naturalWidth / gimg.naturalHeight);
        const gy = H / 2 - joop.pos.y * GALAXY_TILE.parallax * u - th / 2;
        let gx = (-(joop.pos.x * GALAXY_TILE.parallax * u) % tw) - tw;
        ctx.globalAlpha = 0.95;
        for (; gx < W; gx += tw) ctx.drawImage(gimg, gx, gy, tw, th);
        ctx.globalAlpha = 1;
      }

      // 별 2겹 패럴랙스 — 섹터 시드 고정(starHash)이라 흐르기만 하고 반짝이지 않는다.
      // 실사 톤: 정사각 점 대신 원, 색온도 4종(웜화이트/백/청/주황) + 반경 변주.
      for (const layer of [
        { p: 0.35, density: 5, alpha: 0.4, r: 0.8 },
        { p: 0.6, density: 3, alpha: 0.8, r: 1.2 },
      ]) {
        const camX = joop.pos.x * layer.p;
        const camY = joop.pos.y * layer.p;
        const halfW = W / 2 / u;
        const halfH = H / 2 / u;
        ctx.globalAlpha = layer.alpha;
        for (let ix = Math.floor(camX - halfW); ix <= Math.floor(camX + halfW) + 1; ix++) {
          for (let iy = Math.floor(camY - halfH); iy <= Math.floor(camY + halfH) + 1; iy++) {
            for (let k = 0; k < layer.density; k++) {
              const sx = W / 2 + (ix + starHash(ix, iy, k * 2) - camX) * u;
              const sy = H / 2 + (iy + starHash(ix, iy, k * 2 + 1) - camY) * u;
              if (sx < -2 || sx > W + 2 || sy < -2 || sy > H + 2) continue;
              const v = starHash(ix, iy, k * 2 + 2);
              ctx.fillStyle = STAR_COLORS[Math.min(STAR_COLORS.length - 1, (v * STAR_COLORS.length) | 0)];
              ctx.beginPath();
              ctx.arc(sx, sy, layer.r * (0.7 + v * 0.6), 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
      ctx.globalAlpha = 1;

      // 천체(FR-7.2) — 월드 고정 좌표 × 패럴랙스. 날아가면 지구 → 달 → 태양이 전환된다.
      for (const c of CELESTIALS) {
        const img = imagesRef.current.get(c.asset);
        if (!img || !img.complete || img.naturalWidth === 0) continue;
        const px = W / 2 + (c.x - joop.pos.x) * c.parallax * u;
        const py = H / 2 + (c.y - joop.pos.y) * c.parallax * u;
        const size = c.size * u;
        const ratio = img.naturalWidth / img.naturalHeight;
        const w = size * (ratio >= 1 ? 1 : ratio);
        const h = size * (ratio >= 1 ? 1 / ratio : 1);
        if (px + w / 2 < -50 || px - w / 2 > W + 50 || py + h / 2 < -50 || py - h / 2 > H + 50)
          continue;
        ctx.drawImage(img, px - w / 2, py - h / 2, w, h);
      }

      // 태양 인접 앰버 틴트 ≤8% (handoff-m5 §1 — 뜨거움 연출, 가독성 유지)
      const tint = sunTintAlpha(joop.pos.x, joop.pos.y);
      if (tint > 0.005) {
        ctx.fillStyle = amber;
        ctx.globalAlpha = tint;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    };

    const drawJoop = (u: number, thrustDir: Vec | null, strength: number) => {
      const cx = W / 2;
      const cy = H / 2;
      const size = u * 0.17;

      // 분사 화염 — 분사 방향 반대쪽으로 뿜는다
      if (thrustDir && strength > 0 && fuel > 0) {
        const fx = cx - thrustDir.x * size * 0.62;
        const fy = cy - thrustDir.y * size * 0.62;
        const flame = size * (0.24 + strength * 0.75) * (reduceMotion ? 1 : 0.85 + Math.random() * 0.3);
        const ang = Math.atan2(-thrustDir.y, -thrustDir.x);
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(ang);
        const grad = ctx.createLinearGradient(0, 0, flame, 0);
        grad.addColorStop(0, flameColor(strength));
        grad.addColorStop(1, "rgba(56,224,240,0)");
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(0, -size * (0.1 + strength * 0.06));
        ctx.lineTo(flame, 0);
        ctx.lineTo(0, size * (0.1 + strength * 0.06));
        ctx.closePath();
        ctx.fill();
        // 풀출력에 가까우면 백열 코어가 안쪽에 겹친다
        if (strength >= 0.6) {
          ctx.fillStyle = "#f2f7f0";
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.moveTo(0, -size * 0.06);
          ctx.lineTo(flame * 0.55, 0);
          ctx.lineTo(0, size * 0.06);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      const img = imagesRef.current.get("joop-sheet");
      const state = joop.collectFx > 0 ? "collect" : Math.hypot(joop.vel.x, joop.vel.y) > 0.08 ? "move" : "idle";
      if (img && img.complete && img.naturalWidth > 0) {
        const frame = spriteFrame(state, elapsed, reduceMotion);
        ctx.drawImage(
          img,
          frame * JOOP_FRAME,
          0,
          JOOP_FRAME,
          JOOP_FRAME,
          cx - size / 2,
          cy - size / 2,
          size,
          size,
        );
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (joop.collectFx > 0) {
        // 수거 글로우(debris-sheet meta: 액센트 색, 짧은 페이드)
        ctx.strokeStyle = color;
        ctx.globalAlpha = Math.min(1, joop.collectFx * 6);
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };

    const drawItem = (f: Floating, u: number) => {
      const s = toScreen(f.pos);
      const px = f.item.size * u;
      if (s.x < -px || s.x > W + px || s.y < -px || s.y > H + px) return;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(f.rot);
      if (f.item.kind === "fuel") {
        const img = imagesRef.current.get("fuel");
        ctx.shadowColor = amber;
        ctx.shadowBlur = 10;
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, -px / 2, -px / 2, px, px);
        } else {
          ctx.fillStyle = amber;
          ctx.fillRect(-px / 2, -px / 2, px, px);
        }
      } else {
        const sheet = imagesRef.current.get("debris-sheet");
        if (sheet && sheet.complete && sheet.naturalWidth > 0) {
          ctx.drawImage(
            sheet,
            (f.item.sheetFrame ?? 0) * DEBRIS_FRAME,
            0,
            DEBRIS_FRAME,
            DEBRIS_FRAME,
            -px / 2,
            -px / 2,
            px,
            px,
          );
        } else {
          ctx.fillStyle = gridColor;
          ctx.fillRect(-px / 2, -px / 2, px, px);
        }
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    };

    const drawStick = (u: number) => {
      if (!stick) return;
      const R = u * JOYSTICK_R; // 바깥(5단계) 링 반지름 — 미세 조정 여유를 위해 확대
      const { dir, strength, ring } = joystickInput(stick.dx, stick.dy, R);
      // 5원 반투명 링 — 현재 분사 단계까지 밝게(디자인 joystick.svg 참조)
      for (let i = 1; i <= 5; i++) {
        ctx.beginPath();
        ctx.arc(stick.baseX, stick.baseY, (R / 5) * i, 0, Math.PI * 2);
        ctx.strokeStyle = i <= ring ? accent : gridColor;
        ctx.globalAlpha = i <= ring ? 0.65 : 0.3;
        ctx.lineWidth = i === 5 ? 1.5 : 1;
        ctx.stroke();
      }
      // 노브
      const len = Math.hypot(stick.dx, stick.dy);
      const clamped = Math.min(len, R);
      const kx = stick.baseX + (len > 0 ? (stick.dx / len) * clamped : 0);
      const ky = stick.baseY + (len > 0 ? (stick.dy / len) * clamped : 0);
      ctx.beginPath();
      ctx.arc(kx, ky, u * 0.038, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.75;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (dir && strength > 0) {
        ctx.fillStyle = mutedColor;
        ctx.font = `${Math.max(9, Math.round(u * 0.03))}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.fillText(`${Math.round(strength * 100)}%`, stick.baseX, stick.baseY + R + 14);
        ctx.textAlign = "left";
      }
    };

    // ── 루프
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (W < 2 || H < 2) {
        if (running) raf = requestAnimationFrame(frame);
        return;
      }
      const u = unit();
      elapsed += dt;

      // ── 입력 → 분사
      let dir: Vec | null = null;
      let strength = 0;
      if (stick) {
        const inp = joystickInput(stick.dx, stick.dy, u * JOYSTICK_R);
        dir = inp.dir;
        strength = inp.strength;
      } else if (keys.size > 0) {
        let sx = 0;
        let sy = 0;
        for (const k of keys) {
          sx += KEYS[k].x;
          sy += KEYS[k].y;
        }
        const d = Math.hypot(sx, sy);
        if (d > 0) {
          dir = { x: sx / d, y: sy / d };
          strength = 1;
        }
      }

      joop.vel = applyThrust(joop.vel, dir, strength, dt, cfg, fuel);
      joop.pos.x += joop.vel.x * dt;
      joop.pos.y += joop.vel.y * dt;
      joop.collectFx = Math.max(0, joop.collectFx - dt);

      // 연료 소모(분사 세기 비례) — FR-7.6
      if (dir && strength > 0 && fuel > 0) {
        fuel = Math.max(0, fuel - cfg.fuelBurn * strength * dt);
      }

      // 분사가스 파티클 배출(reduced-motion 은 파티클 없이 분사염만 — handoff-m5 §3)
      if (!reduceMotion && dir && strength > 0 && fuel > 0) {
        exhaustAcc = Math.min(2, exhaustAcc + dt * 12 * strength);
        while (exhaustAcc >= 1 && exhaust.length < 60) {
          exhaustAcc -= 1;
          const jx = (Math.random() - 0.5) * 0.03;
          const jy = (Math.random() - 0.5) * 0.03;
          exhaust.push({
            pos: { x: joop.pos.x - dir.x * 0.075 + jx, y: joop.pos.y - dir.y * 0.075 + jy },
            vel: {
              x: joop.vel.x * 0.3 - dir.x * (0.18 + 0.25 * strength) + jx * 2,
              y: joop.vel.y * 0.3 - dir.y * (0.18 + 0.25 * strength) + jy * 2,
            },
            age: 0,
            color: flameColor(strength),
          });
        }
      }
      for (let i = exhaust.length - 1; i >= 0; i--) {
        const e = exhaust[i];
        e.age += dt;
        if (e.age > 0.6) {
          exhaust.splice(i, 1);
          continue;
        }
        e.pos.x += e.vel.x * dt;
        e.pos.y += e.vel.y * dt;
      }
      if (fuel <= 0) {
        if (emptySince === null) emptySince = elapsed;
        const coasting = Math.hypot(joop.vel.x, joop.vel.y);
        // 관성으로 연료 아이템을 주우면 회생 — 아니면 잠시 후 종료
        if (elapsed - emptySince > 4 || coasting < 0.02) {
          endGame();
          return;
        }
      } else {
        emptySince = null;
      }

      // ── 생성·이동·수거
      spawnTimer -= dt;
      if (spawnTimer <= 0 && items.length < 40) {
        spawn();
        spawnTimer = cfg.spawnInterval;
      }
      const despawnR = Math.max(W, H) / u; // 뷰 대각선 밖 멀리
      for (let i = items.length - 1; i >= 0; i--) {
        const f = items[i];
        f.pos.x += f.vel.x * dt;
        f.pos.y += f.vel.y * dt;
        f.rot += f.rotV * dt;

        if (collides(joop.pos, JOOP_RADIUS, f.pos, f.item.size / 2)) {
          if (f.item.kind === "fuel") {
            fuel = Math.min(cfg.fuel, fuel + f.item.value);
            floaters.push({ pos: { ...f.pos }, text: `⛽+${f.item.value}`, color: amber, life: 0.9 });
          } else {
            collected += f.item.value;
            eaten += 1;
            joop.collectFx = 0.35;
            floaters.push({ pos: { ...f.pos }, text: `+${f.item.value}`, color, life: 0.9 });
          }
          items.splice(i, 1);
          continue;
        }
        if (Math.hypot(f.pos.x - joop.pos.x, f.pos.y - joop.pos.y) > despawnR) {
          items.splice(i, 1);
        }
      }

      // ── 렌더
      drawBackground(u);
      for (const f of items) drawItem(f, u);

      // 분사가스 파티클(줍스 뒤에 깔린다)
      for (const e of exhaust) {
        const sp = toScreen(e.pos);
        const t = e.age / 0.6;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, (5 + 6 * t) * (u / 390), 0, Math.PI * 2);
        ctx.fillStyle = e.color;
        ctx.globalAlpha = 0.35 - 0.27 * t;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      drawJoop(u, dir, strength);

      for (let i = floaters.length - 1; i >= 0; i--) {
        const fl = floaters[i];
        fl.life -= dt;
        fl.pos.y -= dt * 0.12;
        if (fl.life <= 0) {
          floaters.splice(i, 1);
          continue;
        }
        const s = toScreen(fl.pos);
        ctx.globalAlpha = Math.min(1, fl.life * 1.6);
        ctx.fillStyle = fl.color;
        ctx.font = `600 ${Math.round(u * 0.045)}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.fillText(fl.text, s.x, s.y);
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
      }

      drawStick(u);

      // ── HUD
      const pad = 12;
      const fs = Math.max(11, Math.round(u * 0.036));
      ctx.font = `${fs}px ui-monospace, monospace`;
      ctx.textBaseline = "top";
      // 연료 바
      const barW = W * 0.34;
      ctx.fillStyle = mutedColor;
      ctx.font = `${Math.max(9, Math.round(fs * 0.75))}px ui-monospace, monospace`;
      ctx.fillText(a.fuel, pad, pad);
      const fuelRatio = Math.max(0, fuel / cfg.fuel);
      ctx.fillStyle = gridColor;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(pad, pad + 13, barW, 7);
      ctx.globalAlpha = 1;
      ctx.fillStyle = fuelRatio < 0.25 ? dangerColor : fuelRatio < 0.5 ? amber : accent;
      ctx.fillRect(pad, pad + 13, barW * Math.min(1, fuelRatio), 7);
      // 속도 — 최고속을 궤도 속도(7.9km/s) 스케일로 환산한 게임식 표기
      const spd = (Math.hypot(joop.vel.x, joop.vel.y) / cfg.maxSpeed) * 7.9;
      ctx.fillStyle = mutedColor;
      ctx.font = `${Math.max(9, Math.round(fs * 0.75))}px ui-monospace, monospace`;
      ctx.fillText(`${a.speed} ${spd.toFixed(1)} km/s`, pad, pad + 26);
      // 수거
      ctx.fillStyle = fgColor;
      ctx.font = `${fs}px ui-monospace, monospace`;
      ctx.textAlign = "right";
      ctx.fillText(`${a.collected} ${collected}`, W - pad, pad);
      ctx.textAlign = "left";

      if (running && !document.hidden) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && running) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", releaseStick);
      canvas.removeEventListener("pointercancel", releaseStick);
    };
  }, [phase, cfg, color, a]);

  const saveResult = useCallback(async () => {
    if (!summary || summary.collected <= 0) return;
    setPhase("saving");
    setSaveError(null);
    try {
      const res = await submitArcadeResult(summary.collected);
      if (res.ok) {
        setResult({ collected: res.collected, total: res.totalCollected });
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
    // 한 판당 1회 결제 — 다시 하려면 다시 지불한다. 그 사이 수신 지역으로 나왔다면
    // payShadowEntry 가 서버에서 재판정해 무료로 통과시킨다.
    setPaid(false);
    setPayError(null);
    setPhase("ready");
  };

  const overlayClass =
    "absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] px-6 text-center";
  const buttonStyle = { background: "var(--color-primary)", color: "var(--color-bg)" } as const;
  const buttonClass =
    "rounded-md px-6 py-2.5 font-mono text-sm font-semibold uppercase tracking-widest disabled:opacity-60";
  const ghostButtonClass = `${buttonClass} border bg-transparent`;
  const ghostStyle = { borderColor: "var(--color-neutral-600)", color: "var(--color-fg)" } as const;

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        ref={boxRef}
        className="game-surface relative mx-3 mb-1 flex-1 overflow-hidden rounded-md border"
        style={{ borderColor: "var(--color-neutral-600)" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" />

        {phase === "playing" && (
          // 우상단: 하단은 PWA 설치 배너(PwaPrompt, 전역 fixed)와 겹칠 수 있다
          <button
            onClick={() => endGameRef.current()}
            className="absolute right-2 top-9 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest"
            style={{ ...ghostStyle, background: "color-mix(in srgb, var(--color-bg) 70%, transparent)" }}
          >
            {a.end}
          </button>
        )}

        {phase === "ready" && (
          <div className={overlayClass}>
            <h2
              className="font-mono text-base font-semibold"
              style={{
                color: needsPay && !paid ? "var(--color-secondary)" : "var(--color-primary)",
              }}
            >
              {needsPay && !paid ? a.shadowTitle : a.briefTitle}
            </h2>
            {!(needsPay && !paid) && (
              <p className="max-w-xs font-mono text-xs leading-relaxed text-[var(--color-fg)]">
                {a.briefBody.replace("{name}", name)}
              </p>
            )}
            <ul className="max-w-xs list-none font-mono text-[11px] leading-relaxed text-[var(--color-muted)]">
              <li>{a.ruleJoystick}</li>
              <li>{a.ruleFuel}</li>
              <li>{a.ruleWorld}</li>
            </ul>
            {/* 음영 통과 중이면 XP 를 지불하거나 수신 복귀를 기다린다 */}
            {needsPay && !paid ? (
              <>
                <p className="max-w-xs font-mono text-[11px] leading-relaxed text-[var(--color-secondary)]">
                  {a.shadowNotice
                    .replace("{cost}", String(shadowGate!.cost))
                    .replace("{mm}", String(Math.floor(waitSec / 60)).padStart(2, "0"))
                    .replace("{ss}", String(waitSec % 60).padStart(2, "0"))}
                </p>
                {payError && (
                  <p role="alert" className="font-mono text-xs text-[var(--color-danger)]">
                    {payError === "insufficient_xp"
                      ? a.insufficientXp
                          .replace("{cost}", String(shadowGate!.cost))
                          .replace("{xp}", String(xpLeft))
                      : a.payError}{" "}
                    <span className="opacity-60">({payError})</span>
                  </p>
                )}
                <button
                  onClick={payAndStart}
                  disabled={!assetsReady || paying || xpLeft < shadowGate!.cost}
                  className={buttonClass}
                  style={buttonStyle}
                >
                  {!assetsReady
                    ? a.loading
                    : paying
                      ? a.paying
                      : a.payShadow.replace("{cost}", String(shadowGate!.cost))}
                </button>
                {/* 왜 버튼이 눌리지 않는지 클릭 전에 알려 준다 */}
                <p
                  className="max-w-xs font-mono text-[10px] leading-relaxed"
                  style={{
                    color:
                      xpLeft < shadowGate!.cost ? "var(--color-danger)" : "var(--color-muted)",
                  }}
                >
                  {xpLeft < shadowGate!.cost
                    ? a.insufficientXp
                        .replace("{cost}", String(shadowGate!.cost))
                        .replace("{xp}", String(xpLeft))
                    : a.xpBalance.replace("{xp}", String(xpLeft))}
                </p>
              </>
            ) : (
              <button
                onClick={() => setPhase("playing")}
                disabled={!assetsReady}
                className={buttonClass}
                style={buttonStyle}
              >
                {assetsReady ? a.start : a.loading}
              </button>
            )}
          </div>
        )}

        {(phase === "over" || phase === "saving" || phase === "saved") && summary && (
          <div className={overlayClass}>
            <h2 className="font-mono text-lg font-semibold text-[var(--color-primary)]">
              {a.gameOver}
            </h2>
            <p className="font-mono text-xs text-[var(--color-muted)]">{a.reasonFuel}</p>

            <p className="font-mono text-sm text-[var(--color-fg)]">
              {a.collected}{" "}
              <span className="text-lg font-semibold text-[var(--color-primary)]">
                {summary.collected.toLocaleString()}
              </span>{" "}
              {a.pieces} · {summary.eaten} {a.eatenUnit}
            </p>

            {phase === "saved" && result ? (
              <>
                <p className="max-w-xs font-mono text-xs leading-relaxed text-[var(--color-primary)]">
                  {a.savedBody.replace("{total}", result.total.toLocaleString())}
                </p>
                <div className="flex gap-2">
                  <button onClick={retry} className={ghostButtonClass} style={ghostStyle}>
                    {a.retry}
                  </button>
                  <button
                    onClick={() => router.push(`/${lang}/joop/map`)}
                    className={buttonClass}
                    style={buttonStyle}
                  >
                    {a.toMap}
                  </button>
                </div>
              </>
            ) : (
              <>
                {saveError && (
                  <p role="alert" className="font-mono text-xs text-[var(--color-danger)]">
                    {a.saveError} <span className="opacity-60">({saveError})</span>
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={retry}
                    disabled={phase === "saving"}
                    className={ghostButtonClass}
                    style={ghostStyle}
                  >
                    {a.retry}
                  </button>
                  {summary.collected > 0 ? (
                    <button
                      onClick={saveResult}
                      disabled={phase === "saving"}
                      className={buttonClass}
                      style={buttonStyle}
                    >
                      {phase === "saving" ? a.saving : a.save}
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push(`/${lang}/joop/map`)}
                      className={buttonClass}
                      style={buttonStyle}
                    >
                      {a.toMap}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
