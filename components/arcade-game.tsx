"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import { recordCollectedKinds, type DebrisKindId } from "@/lib/debris-kinds";
import { DebrisIcon } from "@/components/debris-icon";
import { SoundToggle } from "@/components/sound-toggle";
import * as sfx from "@/lib/sound";
import { JoopSprite } from "@/components/joop-sprite";
import { JOOP_FRAME, joopSheetPath, sheetForColor, spriteFrame } from "@/lib/joop-sprite";
import {
  claimAdDockReward,
  payShadowEntry,
  submitArcadeResult,
  type ArcadeRankingDelta,
} from "@/app/[lang]/joop/arcade/actions";
import {
  AD_DOCK_Z,
  AD_SATELLITES,
  adSatelliteById,
  flybyPose,
  makeFlyby,
  type AdFlyby,
  type FlybyPose,
} from "@/lib/ad-satellites";
import { getAdDock, parseAdDocks, readAdDockSnapshot, recordAdDock } from "@/lib/ad-docks";
import { ChangeIndicator, RankingList } from "@/components/ranking-list";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { trackArcadeCompleted } from "@/lib/analytics";

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

// 미세 금속 파편 색(장식 입자 레이어) — "화면 가득 미세 쓰레기"(UX 리뷰), 수거 판정 없음.
const METAL_COLORS = ["#9aa4ab", "#6f7a82", "#c7ccd1"] as const;

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
  altitudeKm,
  shadowGate,
}: {
  lang: Locale;
  dict: Dictionary;
  color: string;
  name: string;
  config?: ArcadeConfig;
  /** 내 줍스 실제 궤도 고도(km) — 텔레메트리 바 ALT 표기(연출, 정적 값) */
  altitudeKm?: number;
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

  // ── 광고 위성 도킹(FR-7.7 선행 + FR-9.1) ────────────────────────────────
  // ⚠️ adToast·ranking 은 루프 effect deps 에 절대 넣지 않는다 — phase 불변 유지가
  //    "도킹해도 게임이 리셋되지 않는다"의 성립 조건이다.
  const [adToast, setAdToast] = useState<{
    brand: string;
    color: string;
    text: string;
    seq: number;
  } | null>(null);
  const [ranking, setRanking] = useState<ArcadeRankingDelta | null>(null);
  // rAF 루프 → React 다리(endGameRef 의 역방향): 도킹 판정은 루프가, 보상 처리는 여기서.
  const onAdDockRef = useRef<(id: string) => void>(() => {});
  useEffect(() => {
    onAdDockRef.current = (id: string) => {
      const sat = adSatelliteById(id);
      if (!sat) return;
      const seq = Date.now();
      const existing = getAdDock(id);
      if (existing) {
        setAdToast({ brand: sat.brand, color: sat.color, text: a.adDockedAgain.replace("{brand}", sat.brand), seq });
        return;
      }
      // 실제 초대코드 발급(서버, 멱등) — 실패하면 기록하지 않아 다음 패스에 재시도된다.
      claimAdDockReward(id)
        .then((res) => {
          if (res.ok) {
            recordAdDock(id, res.code);
            setAdToast({ brand: sat.brand, color: sat.color, text: a.adDocked.replace("{brand}", sat.brand), seq });
          } else {
            setAdToast({ brand: sat.brand, color: sat.color, text: a.adDockFail, seq });
          }
        })
        .catch(() => setAdToast({ brand: sat.brand, color: sat.color, text: a.adDockFail, seq }));
    };
  }, [a]);
  // 토스트 자동 소거(6초) — seq 로 연속 도킹 시 타이머 리셋
  useEffect(() => {
    if (!adToast) return;
    const id = setTimeout(() => setAdToast(null), 6000);
    return () => clearTimeout(id);
  }, [adToast]);

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
  // 대기 진행 바 기준 — 오버레이 첫 표시 시점의 남은 시간(서버 시각 기준이라 결정적)
  const initialWaitRef = useRef(
    shadowGate ? Math.max(0, Math.ceil((shadowGate.nextChangeAt - shadowGate.serverNow) / 1000)) : 0,
  );

  const payAndStart = useCallback(async () => {
    sfx.unlockAudio(); // await 이전 첫 줄 — 제스처 컨텍스트가 살아 있는 유일한 지점
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
      ["magnet", "/game/item-magnet.svg"], // 자석 팔 끝 헤드(실패 시 집게 호 폴백)
      [GALAXY_TILE.asset, GALAXY_TILE.asset],
      ...CELESTIALS.map((c) => [c.asset, c.asset] as [string, string]),
      ...AD_SATELLITES.map((sat) => [sat.asset, sat.asset] as [string, string]),
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

    // 하단 텔레메트리 바 존 — safe-area 는 프로브 엘리먼트로 1회 실측(env() 직접 읽기 불가)
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;bottom:0;height:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    const safeBottom = probe.getBoundingClientRect().height || 0;
    probe.remove();
    const barH = 96 + safeBottom;

    // 화면 밖 천체 방향 힌트(프레임마다 drawBackground 가 채움 → HUD 단계에서 그림)
    const edgeHints: { x: number; y: number; color: string; glyph: string }[] = [];

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
    // 자석 팔(UX 리뷰: 수거 메커니즘 시각화) — 흡인 반경 안 파편을 끌어당기고 팔을 그린다.
    // 밸런스는 이 상수 2개로만 튜닝한다.
    const MAGNET_RADIUS = 0.22;
    const MAGNET_PULL = 2.5;
    let fuel = cfg.fuel;
    let emptySince: number | null = null; // 연료 0 이 된 경과시각(회생 허용)
    let collected = 0; // 조각(디브리 value 합)
    // 분사·자석 루프 디바운스 — 짧은 끊김마다 오실레이터를 재생성하지 않게 유예를 준다
    let thrustOffFor = 0;
    let magnetOffFor = 0;
    let magnetOn = false;
    let lastFuelWarn = 0;
    let eaten = 0; // 개수
    let elapsed = 0;
    let spawnTimer = 0.8;
    let counterFlash = 0; // 수거 순간 중앙 카운터 앰버 플래시(감쇠)
    // 종류별 수거 카운트 — 종료 시 1회만 localStorage 누적(lib/debris-kinds.ts)
    const kindCounts: Partial<Record<DebrisKindId, number>> = {};

    // ── 광고 위성 플라이바이(FR-7.7) — items 와 완전 분리(자석 흡인·despawn·상한 무관)
    let adFlyby: AdFlyby | null = null;
    let adPose: FlybyPose | null = null;
    let nextAdAt = 16 + Math.random() * 10; // 첫 등장은 이르게(발견성), 이후 40~70s
    let adCamStart: Vec = { x: 0, y: 0 };
    let adDockedThisPass = false;
    // 미도킹 브랜드 우선 스폰 — 마운트 시 1회 스냅샷(플레이 중 도킹分은 다음 판에 반영)
    const dockedBrands = new Set(parseAdDocks(readAdDockSnapshot()).map((r) => r.brandId));
    const pickAdBrand = () => {
      const pool = AD_SATELLITES.filter((sat) => !dockedBrands.has(sat.id));
      const list = pool.length > 0 ? pool : AD_SATELLITES;
      return list[Math.floor(Math.random() * list.length)].id;
    };

    // 조이스틱(FR-7.4)
    type Stick = { baseX: number; baseY: number; dx: number; dy: number; pointerId: number };
    let stick: Stick | null = null;
    const keys = new Set<string>();

    type Floating = { item: ArcadeItem; pos: Vec; vel: Vec; rot: number; rotV: number };
    const items: Floating[] = [];
    type Floater = { pos: Vec; text: string; color: string; life: number; big?: boolean };
    const floaters: Floater[] = [];
    const pushFloater = (fl: Floater) => {
      floaters.push(fl);
      if (floaters.length > 12) floaters.shift(); // 밀도 상향 후 무한 증식 방지
    };

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

    // 시작 프리시드 — 첫 프레임부터 "쓰레기밭"이 보이도록 뷰 안쪽에 미리 흩뿌린다(UX 리뷰).
    const spawnInView = () => {
      if (W < 2 || H < 2) return; // 레이아웃 확정 전이면 생략(루프 스포너가 곧 채운다)
      const u = unit();
      const halfW = W / 2 / u;
      const halfH = H / 2 / u;
      const item = pickArcadeItem(cfg, 1, Math.random()); // kindRoll 1 → 연료 제외, 디브리만
      const pos: Vec = {
        x: joop.pos.x + (Math.random() * 2 - 1) * halfW * 0.85,
        y: joop.pos.y + (Math.random() * 2 - 1) * halfH * 0.85,
      };
      // 시작 지점 바로 위엔 겹치지 않게
      if (Math.hypot(pos.x - joop.pos.x, pos.y - joop.pos.y) < JOOP_RADIUS * 3) return;
      const ang = Math.random() * Math.PI * 2;
      const speed = 0.03 + Math.random() * 0.08;
      items.push({
        item,
        pos,
        vel: { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed },
        rot: Math.random() * Math.PI * 2,
        rotV: reduceMotion ? 0 : (Math.random() - 0.5) * 1.05,
      });
    };
    for (let i = 0; i < 9; i++) spawnInView();

    // ── 입력
    const localXY = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      const p = localXY(e);
      if (p.y > H - barH) return; // 텔레메트리 바 존 터치는 조이스틱을 만들지 않는다
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
      sfx.arcOver(); // 루프(분사·자석)를 먼저 끊고 종료음
      recordCollectedKinds(kindCounts); // 종류별 수거 로컬 누적(랭킹 기여도 아이콘용, 1회)
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

      // 별 2겹 + 미세 금속 파편 1겹 패럴랙스 — 섹터 시드 고정(starHash)이라 흐르기만
      // 하고 반짝이지 않는다. 금속 겹은 근경(0.85)이라 빠르게 흘러 속도감도 만든다.
      for (const layer of [
        { p: 0.35, density: 5, alpha: 0.4, r: 0.8, metal: false },
        { p: 0.6, density: 3, alpha: 0.8, r: 1.2, metal: false },
        { p: 0.85, density: 2, alpha: 0.5, r: 0.55, metal: true },
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
              ctx.fillStyle = layer.metal
                ? METAL_COLORS[Math.min(METAL_COLORS.length - 1, (v * METAL_COLORS.length) | 0)]
                : STAR_COLORS[Math.min(STAR_COLORS.length - 1, (v * STAR_COLORS.length) | 0)];
              ctx.beginPath();
              ctx.arc(sx, sy, layer.r * (0.7 + v * 0.6), 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
      ctx.globalAlpha = 1;

      // 천체(FR-7.2) — 월드 고정 좌표 × 패럴랙스. 날아가면 지구 → 달 → 태양이 전환된다.
      // 배열 순서 = z-order(은하 최후방 → 달(지구 뒤) → 지구 → 태양 → 위성).
      edgeHints.length = 0;
      for (const c of CELESTIALS) {
        const img = imagesRef.current.get(c.asset);
        const px = W / 2 + (c.x - joop.pos.x) * c.parallax * u;
        const py = H / 2 + (c.y - joop.pos.y) * c.parallax * u;
        const size = c.size * u;
        const loaded = !!img && img.complete && img.naturalWidth > 0;
        const ratio = loaded ? img.naturalWidth / img.naturalHeight : 1;
        const w = size * (ratio >= 1 ? 1 : ratio);
        const h = size * (ratio >= 1 ? 1 / ratio : 1);
        if (px + w / 2 < -50 || px - w / 2 > W + 50 || py + h / 2 < -50 || py - h / 2 > H + 50) {
          // 화면 밖 — 지구/달/태양이면 에지 방향 힌트를 기록(HUD 단계에서 그림)
          if (c.hint) {
            const cx0 = W / 2;
            const cy0 = (H - barH) / 2;
            const dx = px - cx0;
            const dy = py - cy0;
            const m = 18;
            // 중심→천체 레이를 게임 뷰 사각형(바 존 제외)에 클램프
            const k = Math.min(
              dx > 0 ? (W - m - cx0) / dx : dx < 0 ? (m - cx0) / dx : Infinity,
              dy > 0 ? (H - barH - m - cy0) / dy : dy < 0 ? (m - cy0) / dy : Infinity,
            );
            edgeHints.push({ x: cx0 + dx * k, y: cy0 + dy * k, color: c.hint.color, glyph: c.hint.glyph });
          }
          continue;
        }
        if (loaded) ctx.drawImage(img, px - w / 2, py - h / 2, w, h);
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

    // 광고 위성 — 본체는 SVG, 워드마크는 캔버스 fillText(게임 UI 와 같은 ui-monospace).
    // 원거리(w≤48px)에서는 워드마크를 생략한다 — 읽을 수 없는 글자는 노이즈다.
    const drawAdSatellite = (f: AdFlyby, pose: FlybyPose, u: number) => {
      const sat = adSatelliteById(f.satId);
      if (!sat) return;
      const w = pose.scale * u;
      const cx = W / 2 + pose.x * u;
      const cy = H / 2 + pose.y * u;
      if (cx + w < -60 || cx - w > W + 60 || cy + w < -60 || cy - w > H + 60) return;
      const img = imagesRef.current.get(sat.asset);
      const loaded = img && img.complete && img.naturalWidth > 0;
      const h = w * (loaded ? img.naturalHeight / img.naturalWidth : 0.5);
      ctx.save();
      ctx.globalAlpha = pose.alpha;
      ctx.translate(cx, cy);
      // 진행 방향으로 미세 뱅크(고정 각) — 회전 애니메이션은 아니라 reduce 에도 무해하지만
      // 완전 정적 선호를 존중해 0 으로 둔다.
      ctx.rotate(reduceMotion ? 0 : Math.atan2(f.dirY, f.dirX) * 0.08);
      if (loaded) {
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else {
        ctx.fillStyle = sat.color;
        ctx.globalAlpha = pose.alpha * 0.5;
        ctx.fillRect(-w * 0.2, -h * 0.1, w * 0.4, h * 0.2);
      }
      if (w > 48) {
        ctx.font = `700 ${Math.max(9, Math.round(w * sat.label.wFrac))}px ui-monospace, monospace`;
        ctx.fillStyle = sat.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(sat.brand, 0, w * sat.label.dy);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
      ctx.restore();
      // 도킹 링 — 미도킹 브랜드가 판정 구간에 들어왔을 때만(원거리에선 완전 무장식)
      if (!dockedBrands.has(sat.id) && pose.z < AD_DOCK_Z + 0.4) {
        ctx.strokeStyle = sat.color;
        ctx.globalAlpha = 0.3 + (reduceMotion ? 0 : 0.18 * Math.sin(elapsed * 4));
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, (JOOP_RADIUS + pose.scale * 0.35) * u, 0, Math.PI * 2);
        ctx.stroke();
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

    // 자석 팔(UX 리뷰: 수거 메커니즘 시각화) — 흡인 중인 가까운 파편 최대 2개로
    // 관절 있는 팔을 뻗는다. 끝은 item-magnet.svg(로드 실패 시 집게 호 폴백).
    const drawMagnetArms = (u: number, targets: { f: Floating; d: number }[]) => {
      if (targets.length === 0) return;
      const cx = W / 2;
      const cy = H / 2;
      const pulse = reduceMotion ? 0.5 : 0.4 + 0.2 * Math.sin(elapsed * 10);
      const magnetImg = imagesRef.current.get("magnet");
      for (const t of targets.slice(0, 2)) {
        const s = toScreen(t.f.pos);
        // 중간 관절 — 직선보다 "장비"처럼 보이게 살짝 꺾는다
        const mx = (cx + s.x) / 2 + (s.y - cy) * 0.08;
        const my = (cy + s.y) / 2 - (s.x - cx) * 0.08;
        ctx.strokeStyle = accent;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(mx, my);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // 팔 끝 — 자석 헤드
        const es = Math.max(9, u * 0.028);
        if (magnetImg && magnetImg.complete && magnetImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(Math.atan2(s.y - cy, s.x - cx) + Math.PI / 2);
          ctx.globalAlpha = Math.min(1, pulse + 0.3);
          ctx.drawImage(magnetImg, -es / 2, -es / 2, es, es);
          ctx.restore();
        } else {
          ctx.globalAlpha = Math.min(1, pulse + 0.3);
          ctx.beginPath();
          ctx.arc(s.x, s.y, es * 0.45, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(s.x, s.y, es * 0.45, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
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
        thrustOffFor = 0;
        sfx.arcThrust(strength); // 루프 생성은 1회, 이후는 세기만 조절
      } else {
        thrustOffFor += dt;
        if (thrustOffFor > 0.12) sfx.arcThrustStop();
      }
      // 연료 경고 — 25% 미만에서 주기적으로(엔진의 gate 가 1.2초 간격을 보장)
      if (fuel > 0 && fuel / cfg.fuel < 0.25 && elapsed - lastFuelWarn > 1.2) {
        lastFuelWarn = elapsed;
        sfx.arcFuelWarn();
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
      if (spawnTimer <= 0 && items.length < 60) {
        spawn();
        spawnTimer = cfg.spawnInterval;
      }
      // 광고 위성 스폰 — 동시 1대(!adFlyby 가드), 희귀 등장
      if (!adFlyby && elapsed >= nextAdAt) {
        adFlyby = makeFlyby(pickAdBrand(), Math.random, elapsed);
        adCamStart = { x: joop.pos.x, y: joop.pos.y };
        adDockedThisPass = false;
      }
      const despawnR = Math.max(W, H) / u; // 뷰 대각선 밖 멀리
      // 자석 팔 대상(흡인 중 가까운 순 최대 2개) — 이번 프레임 드로잉용.
      // splice 로 인덱스가 밀리므로 객체 참조로 든다(방금 수거된 파편에 1프레임 팔이
      // 남는 것은 "집게가 잡는 순간"으로 보여 오히려 자연스럽다).
      const magnetTargets: { f: Floating; d: number }[] = [];
      for (let i = items.length - 1; i >= 0; i--) {
        const f = items[i];
        // 자석 흡인 — 반경 안 파편을 줍스 쪽으로 끌어당긴다(수거의 "행동"이 보이게).
        // 게임플레이 물리라 reduced-motion 에서도 유지한다.
        const ddx = joop.pos.x - f.pos.x;
        const ddy = joop.pos.y - f.pos.y;
        const dd = Math.hypot(ddx, ddy);
        if (dd < MAGNET_RADIUS && dd > 1e-6) {
          const pull = MAGNET_PULL * (1 - dd / MAGNET_RADIUS) * dt;
          f.vel.x += (ddx / dd) * pull;
          f.vel.y += (ddy / dd) * pull;
          const vmag = Math.hypot(f.vel.x, f.vel.y);
          if (vmag > 0.5) {
            f.vel.x = (f.vel.x / vmag) * 0.5;
            f.vel.y = (f.vel.y / vmag) * 0.5;
          }
          magnetTargets.push({ f, d: dd });
        }
        f.pos.x += f.vel.x * dt;
        f.pos.y += f.vel.y * dt;
        f.rot += f.rotV * dt;

        if (collides(joop.pos, JOOP_RADIUS, f.pos, f.item.size / 2)) {
          if (f.item.kind === "fuel") {
            fuel = Math.min(cfg.fuel, fuel + f.item.value);
            sfx.arcFuel();
            pushFloater({ pos: { ...f.pos }, text: `⛽+${f.item.value}`, color: amber, life: 0.9 });
          } else {
            collected += f.item.value;
            eaten += 1;
            sfx.arcCollect(eaten);
            joop.collectFx = 0.35;
            counterFlash = 0.25;
            const kid = f.item.id as DebrisKindId;
            kindCounts[kid] = (kindCounts[kid] ?? 0) + 1;
            pushFloater({
              pos: { ...f.pos },
              text: `${a.collectedPop} +${f.item.value}`,
              color,
              life: 0.9,
              big: true,
            });
          }
          items.splice(i, 1);
          continue;
        }
        if (Math.hypot(f.pos.x - joop.pos.x, f.pos.y - joop.pos.y) > despawnR) {
          items.splice(i, 1);
        }
      }
      // 광고 위성 갱신·도킹 판정 — 줍스는 항상 화면 중심 = 포즈 좌표계의 (0,0)
      if (adFlyby) {
        adPose = flybyPose(adFlyby, elapsed, joop.pos.x - adCamStart.x, joop.pos.y - adCamStart.y);
        if (!adPose) {
          adFlyby = null;
          nextAdAt = elapsed + 40 + Math.random() * 30;
        } else if (
          !adDockedThisPass &&
          adPose.z < AD_DOCK_Z &&
          Math.hypot(adPose.x, adPose.y) < JOOP_RADIUS + adPose.scale * 0.35
        ) {
          adDockedThisPass = true; // 패스당 1회(연속 프레임 재발화 방지)
          const sat = adSatelliteById(adFlyby.satId);
          sfx.arcDock();
          pushFloater({
            pos: { ...joop.pos },
            text: "DOCKED",
            color: sat?.color ?? accent,
            life: 1.2,
            big: true,
          });
          dockedBrands.add(adFlyby.satId); // 이번 판 내 재스폰 우선순위에도 반영
          onAdDockRef.current(adFlyby.satId);
        }
      } else {
        adPose = null;
      }

      // 자석 팔 루프 — 흡인 대상이 있으면 "웅~", 끊기면 0.2초 유예 후 정지
      if (magnetTargets.length > 0) {
        magnetOffFor = 0;
        if (!magnetOn) {
          magnetOn = true;
          sfx.arcMagnet();
        }
      } else if (magnetOn) {
        magnetOffFor += dt;
        if (magnetOffFor > 0.2) {
          magnetOn = false;
          sfx.arcMagnetStop();
        }
      }
      magnetTargets.sort((p, q) => p.d - q.d);
      counterFlash = Math.max(0, counterFlash - dt);

      // ── 렌더
      drawBackground(u);
      // 광고 위성 — 배경 직후·게임플레이 이전 한 곳 고정: 어떤 z 에서도 쓰레기·줍스·
      // 조이스틱을 가리지 않는다(집중도 요구). 근접 시에도 "뒤에 깔린 초대형 구조물".
      if (adFlyby && adPose) drawAdSatellite(adFlyby, adPose, u);

      // 스피드 라인(UX 리뷰: 속도감) — 속도 방향 반대로 흐르는 짧은 선.
      // 위치는 시드 해시(프레임 Math.random 금지)로 8fps 스텝마다 갱신.
      const spdNow = Math.hypot(joop.vel.x, joop.vel.y);
      if (!reduceMotion && spdNow > cfg.maxSpeed * 0.35) {
        const inten = Math.min(1, spdNow / cfg.maxSpeed);
        const nvx = joop.vel.x / spdNow;
        const nvy = joop.vel.y / spdNow;
        const step = Math.floor(elapsed * 8);
        ctx.strokeStyle = fgColor;
        ctx.lineWidth = 1;
        for (let i = 0; i < 7; i++) {
          const rx = starHash(i, step, 0) * W;
          const ry = starHash(i, step, 1) * H;
          const len = (14 + 22 * inten) * (u / 390);
          ctx.globalAlpha = (0.08 + 0.2 * inten) * (0.5 + starHash(i, step, 2) * 0.5);
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - nvx * len, ry - nvy * len);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

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
      drawMagnetArms(u, magnetTargets);

      for (let i = floaters.length - 1; i >= 0; i--) {
        const fl = floaters[i];
        fl.life -= dt;
        fl.pos.y -= dt * 0.12;
        if (fl.life <= 0) {
          floaters.splice(i, 1);
          continue;
        }
        const s = toScreen(fl.pos);
        // big("수거!") 팝업은 크게 + 등장 0.15초 스케일 팝(reduce 는 고정 크기)
        const base = fl.big ? 0.055 : 0.045;
        const pop = fl.big && !reduceMotion && fl.life > 0.75 ? 1 + (fl.life - 0.75) * 1.6 : 1;
        ctx.globalAlpha = Math.min(1, fl.life * 1.6);
        ctx.fillStyle = fl.color;
        ctx.font = `${fl.big ? 700 : 600} ${Math.round(u * base * pop)}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.fillText(fl.text, s.x, s.y);
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
      }

      drawStick(u);

      // ── 에지 방향 힌트(화면 밖 지구/달/태양) — 색 원 + 셰브론 + 글리프
      for (const hnt of edgeHints) {
        const cx0 = W / 2;
        const cy0 = (H - barH) / 2;
        const ang = Math.atan2(hnt.y - cy0, hnt.x - cx0);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = hnt.color;
        ctx.beginPath();
        ctx.arc(hnt.x, hnt.y, 7, 0, Math.PI * 2);
        ctx.fill();
        // 바깥쪽 셰브론
        ctx.beginPath();
        ctx.moveTo(hnt.x + Math.cos(ang) * 12, hnt.y + Math.sin(ang) * 12);
        ctx.lineTo(hnt.x + Math.cos(ang + 2.5) * 8, hnt.y + Math.sin(ang + 2.5) * 8);
        ctx.lineTo(hnt.x + Math.cos(ang - 2.5) * 8, hnt.y + Math.sin(ang - 2.5) * 8);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#04100a";
        ctx.font = `700 9px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(hnt.glyph, hnt.x, hnt.y + 0.5);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      // ── 하단 텔레메트리 바(SpaceX 중계풍) — 흩어져 있던 계기를 전부 통합.
      //    [SPEED 게이지] [수거 0000 + T+ + ALT] [FUEL 게이지]
      const fs = Math.max(11, Math.round(u * 0.036));
      const micro = Math.max(9, Math.round(fs * 0.75));
      const barTop = H - barH;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#030a05";
      ctx.fillRect(0, barTop, W, barH);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, barTop + 0.5);
      ctx.lineTo(W, barTop + 0.5);
      ctx.stroke();

      const gaugeR = 26;
      const gaugeY = barTop + 40;
      const drawGauge = (
        gx: number,
        frac: number,
        colorArc: string,
        valueText: string,
        label: string,
      ) => {
        ctx.lineWidth = 4;
        ctx.strokeStyle = gridColor;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(gx, gaugeY, gaugeR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = colorArc;
        ctx.beginPath();
        ctx.arc(gx, gaugeY, gaugeR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, frac)));
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = fgColor;
        ctx.font = `600 ${fs}px ui-monospace, monospace`;
        ctx.fillText(valueText, gx, gaugeY);
        ctx.textBaseline = "top";
        ctx.fillStyle = mutedColor;
        ctx.font = `${micro}px ui-monospace, monospace`;
        ctx.fillText(label, gx, gaugeY + gaugeR + 5);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      };

      // 좌 — 속도(실 LEO 7.9km/s 를 게임 최고속에 대응시키는 기존 환산)
      const spd = (spdNow / cfg.maxSpeed) * 7.9;
      drawGauge(W * 0.18, spdNow / cfg.maxSpeed, accent, spd.toFixed(1), `${a.speed} km/s`);

      // 우 — 연료(기존 임계색 로직)
      const fuelRatio = Math.max(0, fuel / cfg.fuel);
      const fuelColor = fuelRatio < 0.25 ? dangerColor : fuelRatio < 0.5 ? amber : accent;
      drawGauge(W * 0.82, fuelRatio, fuelColor, `${Math.round(fuelRatio * 100)}%`, a.fuel);

      // 중앙 — 수거 카운터(자릿수 고정 + 앰버 플래시) / T+ 시계 / 실궤도 고도
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = mutedColor;
      ctx.font = `${micro}px ui-monospace, monospace`;
      ctx.fillText(a.collected, W / 2, barTop + 8);
      ctx.fillStyle = counterFlash > 0 ? amber : fgColor;
      ctx.font = `700 ${Math.round(u * 0.062)}px ui-monospace, monospace`;
      ctx.fillText(String(collected).padStart(4, "0"), W / 2, barTop + 8 + micro + 2);
      const tSec = Math.floor(elapsed);
      const tStr = `T+${String(Math.floor(tSec / 60)).padStart(2, "0")}:${String(tSec % 60).padStart(2, "0")}`;
      ctx.fillStyle = mutedColor;
      ctx.font = `${micro}px ui-monospace, monospace`;
      ctx.fillText(
        altitudeKm ? `${tStr} · ALT ${Math.round(altitudeKm)} KM` : tStr,
        W / 2,
        barTop + 8 + micro + 2 + Math.round(u * 0.062) + 4,
      );
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      if (running && !document.hidden) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (document.hidden) sfx.stopAll(); // 탭 전환 중 분사·자석 루프가 계속 울리지 않게
      if (!document.hidden && running) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      sfx.stopAll(); // 루프 누수 방지
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
  }, [phase, cfg, color, a, altitudeKm]);

  const saveResult = useCallback(async () => {
    if (!summary || summary.collected <= 0) return;
    setPhase("saving");
    setSaveError(null);
    try {
      const res = await submitArcadeResult(summary.collected);
      if (res.ok) {
        trackArcadeCompleted(res.collected, res.totalCollected);
        setResult({ collected: res.collected, total: res.totalCollected });
        setRanking(res.ranking);
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
    setRanking(null);
    setAdToast(null);
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
    <div className="relative flex flex-1 flex-col arcade-healing">
      {/* 풀블리드 — 테두리 없이 폰 화면을 꽉 채운다(UX 라운드 2026-07-29).
          boxRef(크기 측정)·game-surface(iOS 제스처 차단)는 반드시 유지. */}
      <div
        ref={boxRef}
        className="game-surface relative flex-1 overflow-hidden"
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" />

        {phase === "playing" && (
          <>
            {/* 도킹 토스트 — phase 를 바꾸지 않는다(루프 리셋 금지). 게임은 계속 흐른다. */}
            {adToast && (
              <div
                key={adToast.seq}
                className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] flex justify-center"
                role="status"
              >
                <div
                  className="max-w-[85%] rounded-md border px-3 py-1.5 text-center font-mono text-[11px]"
                  style={{
                    borderColor: adToast.color,
                    color: "var(--color-fg)",
                    background: "color-mix(in srgb, var(--color-bg) 85%, transparent)",
                    boxShadow: `0 0 12px color-mix(in srgb, ${adToast.color} 45%, transparent)`,
                  }}
                >
                  <span style={{ color: adToast.color }}>{adToast.text}</span>
                  <span className="ml-1.5 text-[var(--color-muted)]">{a.adDockedHint}</span>
                </div>
              </div>
            )}
            {/* 텔레메트리 바 바로 위 좌/우 — 지도 복귀·종료(상단 헤더를 대체) */}
            <Link
              href={`/${lang}/joop/map`}
              className="absolute left-2 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest"
              style={{ ...ghostStyle, background: "color-mix(in srgb, var(--color-bg) 70%, transparent)" }}
            >
              {a.toMap}
            </Link>
            <button
              onClick={() => endGameRef.current()}
              className="absolute right-2 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest"
              style={{ ...ghostStyle, background: "color-mix(in srgb, var(--color-bg) 70%, transparent)" }}
            >
              {a.end}
            </button>
            {/* 음소거 — 고스트 버튼 한 줄 위(엄지 사정권, 조이스틱 영역 밖) */}
            <div
              className="absolute right-2 bottom-[calc(env(safe-area-inset-bottom)+9.5rem)] rounded-md border"
              style={{
                borderColor: "var(--color-neutral-600)",
                background: "color-mix(in srgb, var(--color-bg) 70%, transparent)",
              }}
            >
              <SoundToggle dict={dict} />
            </div>
          </>
        )}

        {phase === "ready" && (
          <div className={overlayClass}>
            <div className="absolute right-3 top-3">
              <SoundToggle dict={dict} />
            </div>
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
            {/* 규칙 3줄은 일반 진입에만 — 음영 대기 화면은 텍스트 최소화(UX 리뷰) */}
            {!(needsPay && !paid) && (
              <ul className="max-w-xs list-none font-mono text-[11px] leading-relaxed text-[var(--color-muted)]">
                <li>{a.ruleJoystick}</li>
                <li>{a.ruleFuel}</li>
                <li>{a.ruleWorld}</li>
              </ul>
            )}
            {/* 음영 통과 중이면 XP 를 지불하거나 수신 복귀를 기다린다.
                핵심 선택지("기다리기 vs 지불")만 크게: 큰 카운트다운 + 큰 CTA. */}
            {needsPay && !paid ? (
              <>
                {/* 수신 복귀 카운트다운 — 큰 숫자 + 진행 바 (link-status 패턴) */}
                <div className="w-full max-w-xs">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
                    {a.returnIn}
                  </p>
                  <p
                    className="font-mono font-semibold text-[var(--color-secondary)]"
                    style={{ fontSize: "var(--text-display-lg)", textShadow: "var(--glow-secondary)" }}
                  >
                    T-{String(Math.floor(waitSec / 60)).padStart(2, "0")}:
                    {String(waitSec % 60).padStart(2, "0")}
                  </p>
                  <div
                    className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
                    style={{ background: "var(--color-neutral-700)" }}
                    aria-hidden
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${initialWaitRef.current > 0 ? Math.max(0, Math.min(100, (1 - waitSec / initialWaitRef.current) * 100)) : 0}%`,
                        background: "var(--color-secondary)",
                      }}
                    />
                  </div>
                </div>

                {/* 기다리는 동안 재활용 연출 — 줍스가 수거함에 파편을 비운다(절제 버전) */}
                <div className="flex items-end gap-3" aria-hidden>
                  <JoopSprite color={color} size={56} />
                  <div className="relative flex h-14 w-10 items-end justify-center">
                    <span className="absolute left-1/2 top-0 -translate-x-1/2">
                      {(["bolt", "chip", "can"] as const).map((k, i) => (
                        <span
                          key={k}
                          className="debris-drop absolute left-1/2 -translate-x-1/2"
                          style={{ animationDelay: `${i * 0.45}s` }}
                        >
                          <DebrisIcon kind={k} size={12} />
                        </span>
                      ))}
                    </span>
                    {/* 재활용 수거함 — 인라인 SVG (그린 톤) */}
                    <svg width="34" height="30" viewBox="0 0 34 30" className="relative">
                      <rect x="3" y="8" width="28" height="20" rx="2" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="1.5" />
                      <rect x="1" y="5" width="32" height="4" rx="1" fill="var(--color-primary)" opacity="0.85" />
                      <path d="M13 16l3-4 2 3 3-4" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
                  {a.recycling}
                </p>

                <p className="max-w-xs font-mono text-[11px] leading-relaxed text-[var(--color-secondary)]">
                  {a.shadowNotice.replace("{cost}", String(shadowGate!.cost))}
                </p>
                {payError && payError !== "insufficient_xp" && (
                  <p role="alert" className="font-mono text-xs text-[var(--color-danger)]">
                    {a.payError} <span className="opacity-60">({payError})</span>
                  </p>
                )}
                <button
                  onClick={payAndStart}
                  disabled={!assetsReady || paying || xpLeft < shadowGate!.cost}
                  className="crt-brackets btn-brackets btn-brackets-lg max-w-xs"
                  style={{ "--bracket-color": "var(--color-secondary)", color: "var(--color-secondary)" } as React.CSSProperties}
                >
                  {!assetsReady
                    ? a.loading
                    : paying
                      ? a.paying
                      : a.payShadow.replace("{cost}", String(shadowGate!.cost))}
                </button>
                {/* 왜 버튼이 눌리지 않는지 클릭 전에 알려 준다(잔액 안내는 이 한 곳만) */}
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
                onClick={() => {
                  sfx.unlockAudio();
                  setPhase("playing");
                }}
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
          <div
            className={
              phase === "saved"
                ? "absolute inset-0 flex flex-col overflow-y-auto bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] px-6"
                : overlayClass
            }
          >
            {/* saved: 랭킹 목록까지 담아 길어질 수 있다 — m-auto(짧으면 중앙, 길면 스크롤).
                다른 phase: display:contents 로 기존 오버레이 레이아웃 그대로. */}
            <div
              className={
                phase === "saved"
                  ? "m-auto flex w-full max-w-sm flex-col items-center gap-3 py-8 text-center"
                  : "contents"
              }
            >
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
                {/* 이번 판 랭킹 변화 — 뷰의 prev_rank(주간)와 달리 저장 전/후 순위 비교 */}
                {ranking && ranking.rankAfter !== null && (
                  <p className="font-mono text-sm text-[var(--color-fg)]">
                    {ranking.rankBefore === null ? (
                      <span className="text-[var(--color-success)]">{a.rankNew}</span>
                    ) : ranking.rankBefore === ranking.rankAfter ? (
                      <span className="text-[var(--color-muted)]">{a.rankNoChange}</span>
                    ) : (
                      a.rankShift
                        .replace("{before}", String(ranking.rankBefore))
                        .replace("{after}", String(ranking.rankAfter))
                    )}{" "}
                    <ChangeIndicator
                      delta={(ranking.rankBefore ?? ranking.rankAfter) - ranking.rankAfter}
                    />
                  </p>
                )}
                {ranking && ranking.top.length > 0 && (
                  <div className="w-full text-left">
                    <RankingList
                      rows={ranking.top}
                      dict={dict}
                      lang={lang}
                      myRanking={ranking.me}
                      compact
                    />
                  </div>
                )}
                <div className="flex flex-wrap justify-center gap-2">
                  <button onClick={retry} className={ghostButtonClass} style={ghostStyle}>
                    {a.retry}
                  </button>
                  <button
                    onClick={() => router.push(`/${lang}`)}
                    className={buttonClass}
                    style={buttonStyle}
                  >
                    {a.home}
                  </button>
                  <button
                    onClick={() => router.push(`/${lang}/joop/map`)}
                    className={ghostButtonClass}
                    style={ghostStyle}
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
          </div>
        )}
      </div>
    </div>
  );
}
