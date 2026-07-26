// 지상 훈련 미니게임 로직 — 순수 함수(부수효과 없음). 클라이언트에서 import 해도 안전하다.
//
// ── 방식 개편(2026-07-27) ────────────────────────────────────────────────
// 이전: 화면 어디를 눌러도 그 방향으로 분사(추력)해서 공중을 자유롭게 날아다니며 쓰레기를 먹었다.
// 문제: "지상 훈련"인데 줍스가 땅에 발을 붙이지 않고 화면 공중에 떠 있어서 장면이 어색했고,
//       조작 학습(FR-3.1) 외에 "무엇을 먹어도 되는지"를 배우는 요소가 전혀 없었다.
// 이후: 줍스는 땅에 서서 **좌우로만** 움직인다. 위에서 물체가 떨어지고,
//   - 우주 쓰레기(SAFE_ITEMS)   → 받아내면 수거 성공, 유대 상승
//   - 작동 중인 위성(HAZARD_ITEMS) → 부딪히면 내구도 손실, 유대 하락
// 즉 "먹어도 되는 것 / 충돌하면 안 되는 것"을 식별하는 훈련이다(EPIC 3 · FR-3.1).
//
// 관성·분사 물리(applyThrust 등)는 이 화면에서 걷어냈다. 우주 아케이드(M5, FR-7.4/7.5)는
// 여전히 5원 조이스틱 + 관성이 요구사항이라, 그때 그 화면 몫으로 다시 세운다.
// 지상과 우주의 조작이 갈라진 셈이므로 FR-7.1("동일 조작")은 M5에서 재확인이 필요하다.

export type MinigameConfig = {
  /** 좌우 이동 속도 — 초당 화면 폭의 몇 배를 가는지 */
  moveSpeed: number;
  /** 낙하 시작 속도 — 초당 화면 높이의 몇 배를 내려오는지 */
  fallSpeed: number;
  /** 난이도 상승 계수 — 경과 초에 비례해 낙하 속도↑ / 생성 간격↓ */
  fallRamp: number;
  /** 물체 생성 간격(초, 시작값) */
  spawnInterval: number;
  /** 떨어지는 물체 중 위험물(작동 중인 위성) 비율 0~1 */
  hazardRatio: number;
  /** 내구도 — 위험물과 이만큼 부딪히면 훈련 종료 */
  lives: number;
  /** 훈련 제한 시간(초) */
  duration: number;
  /** 쓰레기 1개당 XP (서버에서 계산에 사용) */
  xpPerDebris: number;
};

export const DEFAULT_CONFIG: MinigameConfig = {
  moveSpeed: 0.85,
  fallSpeed: 0.3,
  fallRamp: 0.012,
  spawnInterval: 0.85,
  hazardRatio: 0.35,
  lives: 3,
  duration: 60,
  xpPerDebris: 25,
};

/** 떨어지는 물체 한 종류. asset 은 public/game 아래의 SVG(디자인 2순위 에셋 재사용). */
export type FallingItem = {
  id: string;
  asset: string;
  /** true = 충돌하면 안 되는 것(작동 중인 위성) */
  hazard: boolean;
  /** 화면 최소변(min(W,H)) 대비 높이 비율 */
  scale: number;
};

/** 받아내야 하는 것 — 궤도를 떠도는 폐기물. */
export const SAFE_ITEMS: readonly FallingItem[] = [
  { id: "can", asset: "/game/debris-can.svg", hazard: false, scale: 0.075 },
  { id: "bolt", asset: "/game/debris-bolt.svg", hazard: false, scale: 0.06 },
  { id: "panel", asset: "/game/debris-panel.svg", hazard: false, scale: 0.08 },
  { id: "circuit", asset: "/game/debris-circuit.svg", hazard: false, scale: 0.075 },
  { id: "antenna", asset: "/game/debris-antenna.svg", hazard: false, scale: 0.08 },
  { id: "fragment", asset: "/game/debris-satellite-fragment.svg", hazard: false, scale: 0.085 },
];

/** 피해야 하는 것 — 아직 임무 중인 위성. 부딪히면 줍스도, 위성도 손상된다. */
export const HAZARD_ITEMS: readonly FallingItem[] = [
  { id: "comm", asset: "/game/satellite-comm.svg", hazard: true, scale: 0.13 },
  { id: "probe", asset: "/game/satellite-probe.svg", hazard: true, scale: 0.12 },
];

export const ALL_ITEMS: readonly FallingItem[] = [...SAFE_ITEMS, ...HAZARD_ITEMS];

/**
 * 다음에 떨어질 물체를 고른다. 난수를 인자로 받아 순수 함수로 유지한다(테스트 가능).
 * @param hazardRoll 0~1 — hazardRatio 미만이면 위험물
 * @param pickRoll   0~1 — 해당 목록 안에서의 선택
 */
export function pickItem(cfg: MinigameConfig, hazardRoll: number, pickRoll: number): FallingItem {
  const pool = hazardRoll < cfg.hazardRatio ? HAZARD_ITEMS : SAFE_ITEMS;
  const i = Math.min(pool.length - 1, Math.floor(pickRoll * pool.length));
  return pool[i];
}

/** 경과 시간에 따른 낙하 속도(화면 높이 배수/초). */
export function fallSpeedAt(cfg: MinigameConfig, elapsed: number): number {
  return cfg.fallSpeed * (1 + cfg.fallRamp * Math.max(0, elapsed));
}

/** 경과 시간에 따른 생성 간격(초). 너무 촘촘해지면 피할 수 없으므로 하한을 둔다. */
export function spawnIntervalAt(cfg: MinigameConfig, elapsed: number): number {
  const scaled = cfg.spawnInterval / (1 + cfg.fallRamp * Math.max(0, elapsed));
  return Math.max(0.28, scaled);
}

/**
 * 유대(0~100) — 잘 받아내면 쌓이고, 위성에 부딪히면 크게 깎인다.
 * 지금은 결과 화면 표시용(연출)이고 DB에는 남기지 않는다. 영속화는 인벤토리(EPIC 8)와 함께.
 */
export function bondFrom(caught: number, hits: number): number {
  return Math.max(0, Math.min(100, caught * 5 - hits * 12));
}

export type BondTier = "cold" | "warm" | "close" | "best";

export function bondTier(bond: number): BondTier {
  if (bond < 25) return "cold";
  if (bond < 55) return "warm";
  if (bond < 85) return "close";
  return "best";
}

/** 수거 개수 → 획득 xp */
export function scoreToXp(collected: number, cfg: MinigameConfig): number {
  return collected * cfg.xpPerDebris;
}

/** xp → 레벨 (1 + floor(xp/100)) */
export function levelFromXp(xp: number): number {
  return 1 + Math.floor(xp / 100);
}
