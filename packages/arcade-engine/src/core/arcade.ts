// 아케이드(우주 수거, M5 / EPIC 7) 물리·로직 — 순수 함수(부수효과 없음). 클라 안전.
//
// 관성 있음 · 마찰 0(FR-7.5). 지상 훈련 초기 버전(M3)의 분사 물리를 시간 기반(초 단위)으로
// 재정비해 가져왔다 — 옛 코드는 프레임 기반이라 주사율에 따라 체감이 달라졌다.
// 상수는 joop_03_game_config 의 arcade_* 키로 주입(EPIC 10), 폴백은 아래 DEFAULT.
//
// 좌표 규약: 월드 단위 1.0 = 화면 최소변(min(w,h)). 속도는 units/s, 가속은 units/s².
// 월드는 개방형(경계 없음) — 카메라가 줍스를 따라가고 배경이 흐른다(FR-7.2).

export type ArcadeConfig = {
  thrust: number; // 최대 가속(units/s²)
  maxSpeed: number; // 속도 상한(units/s)
  fuel: number; // 초기 분사가스
  fuelBurn: number; // 풀분사(세기 1.0) 시 초당 소모량
  friction: number; // 마찰(0 = 관성 유지)
  spawnInterval: number; // 쓰레기 생성 간격(초)
  fuelItemRatio: number; // 생성 물체 중 연료 아이템 비율(0~1)
};

export const DEFAULT_ARCADE_CONFIG: ArcadeConfig = {
  thrust: 1.2,
  maxSpeed: 0.9,
  fuel: 100,
  fuelBurn: 12,
  friction: 0,
  spawnInterval: 0.7, // UX 리뷰: "쓰레기가 안 보인다" — 1.1 → 0.7 로 밀도 상향
  fuelItemRatio: 0.12,
};

export type Vec = { x: number; y: number };

/**
 * 분사 적용 — dir(단위 벡터) 방향으로 strength(0~1) 세기만큼 dt초 가속.
 * 연료가 없으면 가속 없음(관성만). 마찰이 0이면 속도가 유지된다(FR-7.5).
 */
export function applyThrust(
  vel: Vec,
  dir: Vec | null,
  strength: number,
  dt: number,
  cfg: ArcadeConfig,
  fuel: number,
): Vec {
  let vx = vel.x;
  let vy = vel.y;

  if (dir && fuel > 0 && strength > 0) {
    vx += dir.x * cfg.thrust * strength * dt;
    vy += dir.y * cfg.thrust * strength * dt;
  }

  if (cfg.friction > 0) {
    const k = Math.max(0, 1 - cfg.friction * dt);
    vx *= k;
    vy *= k;
  }

  const speed = Math.hypot(vx, vy);
  if (speed > cfg.maxSpeed) {
    vx = (vx / speed) * cfg.maxSpeed;
    vy = (vy / speed) * cfg.maxSpeed;
  }
  return { x: vx, y: vy };
}

/** 원-원 충돌(월드 단위). */
export function collides(a: Vec, ar: number, b: Vec, br: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < ar + br;
}

/**
 * 5원 조이스틱(FR-7.4) — 드래그 오프셋(px)을 방향 + 분사 세기로 변환.
 * 링 5개가 세기 0.2/0.4/0.6/0.8/1.0 단계다. 데드존(중심 8px)은 세기 0.
 */
export function joystickInput(
  dx: number,
  dy: number,
  ringRadius: number, // 바깥 링(5단계)의 반지름 px
): { dir: Vec | null; strength: number; ring: number } {
  const dist = Math.hypot(dx, dy);
  if (dist < 8) return { dir: null, strength: 0, ring: 0 };
  const ring = Math.min(5, Math.max(1, Math.ceil((dist / ringRadius) * 5)));
  return { dir: { x: dx / dist, y: dy / dist }, strength: ring / 5, ring };
}

// ── 떠다니는 물체 ─────────────────────────────────────────────
// 쓰레기 6종은 지상 훈련과 같은 debris-sheet 프레임을 쓴다(meta 의 value = 수거 조각 수).
// fuel 아이템은 연료를 충전한다(FR-7.6 의 "분사가스" 루프를 게임 안에서 연장).

export type ArcadeItem = {
  id: string;
  /** debris-sheet.png 프레임 인덱스(쓰레기), 또는 단일 에셋 경로(연료) */
  sheetFrame?: number;
  asset?: string;
  kind: "debris" | "fuel";
  /** 수거 시 더해지는 조각 수(debris) / 충전량(fuel) */
  value: number;
  /** 월드 단위 지름 */
  size: number;
};

export const ARCADE_DEBRIS: readonly ArcadeItem[] = [
  { id: "can", sheetFrame: 0, kind: "debris", value: 3, size: 0.075 },
  { id: "bolt", sheetFrame: 1, kind: "debris", value: 1, size: 0.055 },
  { id: "nut", sheetFrame: 2, kind: "debris", value: 1, size: 0.055 },
  { id: "panel", sheetFrame: 3, kind: "debris", value: 5, size: 0.1 },
  { id: "strut", sheetFrame: 4, kind: "debris", value: 3, size: 0.075 },
  { id: "chip", sheetFrame: 5, kind: "debris", value: 2, size: 0.06 },
];

export const ARCADE_FUEL_ITEM: ArcadeItem = {
  id: "fuel",
  asset: "/game/item-fuel.svg",
  kind: "fuel",
  value: 18,
  size: 0.07,
};

/** 다음 생성 물체 선택 — 난수를 인자로 받아 순수 함수 유지. */
export function pickArcadeItem(cfg: ArcadeConfig, kindRoll: number, pickRoll: number): ArcadeItem {
  if (kindRoll < cfg.fuelItemRatio) return ARCADE_FUEL_ITEM;
  const i = Math.min(ARCADE_DEBRIS.length - 1, Math.floor(pickRoll * ARCADE_DEBRIS.length));
  return ARCADE_DEBRIS[i];
}

// ── 배경 천체(FR-7.2) — 월드 고정 좌표. 카메라가 흐르면 지구 → 달 → 태양이 전환된다.
// parallax < 1 이라 멀리 있는 느낌으로 천천히 흐른다.
export type Celestial = {
  asset: string;
  /** 월드 좌표(units) */
  x: number;
  y: number;
  /** 월드 단위 크기 */
  size: number;
  /** 카메라 대비 이동 비율(0=완전 고정, 1=전경) */
  parallax: number;
  /** 화면 밖일 때 에지 방향 힌트 — 색 + 글리프(지구/달/태양만 부여) */
  hint?: { color: string; glyph: string };
};

// 화면 오프셋 = (x − cam) × parallax × unit. 시작(cam=0)에는 지구만 아래에 보이고,
// 오른쪽으로 2~3유닛 날면 달, 5유닛쯤에서 태양, 왼쪽으로 가면 은하수가 나타나도록 배치.
//
// z-order = **배열 순서**(앞 항목이 뒤에 깔린다). 은하(최후방, parallax 0.12~0.18) →
// 달(지구 뒤·원경) → 지구 → 태양 → 위성(중경). 달은 지구보다 parallax 를 낮춰
// "더 멀리" 흐르게 했다(겹치면 지구가 위에 그려진다 — UX 라운드 2026-07-29).
// 새 은하 추가 = 마스터 SVG 1개 + gen:game TARGETS 1행 + 아래 배열 1행.
export const SUN_POS = { x: 5.6, y: 0.3 } as const;

export const CELESTIALS: readonly Celestial[] = [
  // 유명 은하 5종(장식 전용, 상호작용 없음) — 사방에 분산해 어느 방향으로 날아도 만난다
  { asset: "/game/bg-galaxy-andromeda.webp", x: -4.5, y: -2.2, size: 0.9, parallax: 0.15 },
  { asset: "/game/bg-galaxy-whirlpool.webp", x: 7.5, y: -1.8, size: 0.7, parallax: 0.14 },
  { asset: "/game/bg-galaxy-sombrero.webp", x: 3.5, y: 3.0, size: 0.6, parallax: 0.16 },
  { asset: "/game/bg-galaxy-pinwheel.webp", x: -1.8, y: -3.4, size: 0.65, parallax: 0.13 },
  { asset: "/game/bg-galaxy-lmc.webp", x: 6.2, y: 2.6, size: 0.8, parallax: 0.18 },
  // 달 — 지구 뒤(배열 앞) + 더 작게 + 원경 시차
  { asset: "/game/bg-moon.webp", x: 3.2, y: -1.3, size: 0.42, parallax: 0.26, hint: { color: "#b0a793", glyph: "M" } },
  { asset: "/game/bg-earth.webp", x: 0, y: 2.0, size: 3.2, parallax: 0.35, hint: { color: "#38e0f0", glyph: "E" } },
  { asset: "/game/bg-sun.webp", x: SUN_POS.x, y: SUN_POS.y, size: 0.85, parallax: 0.3, hint: { color: "#ffb23e", glyph: "S" } },
  // 장식 위성(중경 0.6, 상호작용 없음 — FR-7.7 원근 연출은 후속)
  { asset: "/game/satellite.png", x: 1.9, y: 0.75, size: 0.34, parallax: 0.6 },
  { asset: "/game/satellite.png", x: -2.1, y: 1.0, size: 0.26, parallax: 0.65 },
  { asset: "/game/satellite.png", x: 4.4, y: -1.1, size: 0.3, parallax: 0.55 },
];

/** 최원경 은하 타일(handoff-m5 §1) — 2048×1024, 수평 반복, 스크롤 계수 0.1. */
export const GALAXY_TILE = { asset: "/game/bg-galaxy.webp", parallax: 0.1, height: 1.6 } as const;

/** 태양 인접 앰버 틴트(≤8%, handoff-m5 §1) — 태양과의 월드 거리로 0~0.08 보간.
 *  배열 검색(find) 대신 SUN_POS 상수를 참조한다 — 배열 재구성에 안전. */
export function sunTintAlpha(camX: number, camY: number): number {
  const d = Math.hypot(camX - SUN_POS.x, camY - SUN_POS.y);
  return Math.max(0, Math.min(0.08, (1 - d / 3.5) * 0.08));
}

/**
 * 별 패럴랙스용 결정적 의사난수 — 섹터(정수 좌표)에서 항상 같은 별 배치가 나온다.
 * Math.random 을 프레임마다 쓰면 별이 반짝이며 움직여 버리므로 시드 기반으로 고정한다.
 */
export function starHash(ix: number, iy: number, k: number): number {
  let h = (ix * 374761393 + iy * 668265263 + k * 1440662683) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
