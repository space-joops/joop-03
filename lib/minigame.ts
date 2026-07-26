// 지상 미니게임 물리/로직 — 순수 함수(부수효과 없음).
// ⚠️ 아케이드(M5)와 "동일 조작"(FR-7.1)이라 이 엔진을 M5에서 재사용한다.
// 관성 있음, 마찰 0. 상수는 joop_03_game_config 에서 주입 가능(FR-7.5 / EPIC 10).

export type MinigameConfig = {
  thrust: number; // 추력(가속)
  maxSpeed: number; // 최대 속도
  fuel: number; // 초기 연료(분사가스)
  friction: number; // 마찰(0 = 관성 유지)
  xpPerDebris: number; // 쓰레기당 xp
};

export const DEFAULT_CONFIG: MinigameConfig = {
  thrust: 0.35,
  maxSpeed: 6,
  fuel: 100,
  friction: 0,
  xpPerDebris: 8,
};

export type Vec = { x: number; y: number };

export type Player = {
  pos: Vec; // 정규화 좌표(0~1)
  vel: Vec; // px/frame 기준(월드 스케일에서 곱함)
  radius: number; // 정규화 반경
};

export type Debris = {
  pos: Vec;
  vel: Vec;
  radius: number;
  alive: boolean;
};

/**
 * 추력 적용: 방향(단위 벡터)과 세기(0~1)로 속도를 가속. 마찰이 0이면 관성 유지.
 * 연료가 없으면 추력 없음(관성만).
 */
export function applyThrust(
  vel: Vec,
  dir: Vec | null,
  strength: number,
  cfg: MinigameConfig,
  fuel: number,
): Vec {
  let vx = vel.x;
  let vy = vel.y;

  if (dir && fuel > 0 && strength > 0) {
    vx += dir.x * cfg.thrust * strength;
    vy += dir.y * cfg.thrust * strength;
  }

  // 마찰(관성 게임은 0)
  if (cfg.friction > 0) {
    vx *= 1 - cfg.friction;
    vy *= 1 - cfg.friction;
  }

  // 최대 속도 클램프
  const speed = Math.hypot(vx, vy);
  if (speed > cfg.maxSpeed) {
    vx = (vx / speed) * cfg.maxSpeed;
    vy = (vy / speed) * cfg.maxSpeed;
  }
  return { x: vx, y: vy };
}

/** 정규화 위치를 갱신하고 경계(0~1)에서 반사. worldScale 은 vel 을 정규화로 환산하는 계수. */
export function stepPosition(pos: Vec, vel: Vec, worldScale: number): { pos: Vec; vel: Vec } {
  let x = pos.x + (vel.x * worldScale) / 1000;
  let y = pos.y + (vel.y * worldScale) / 1000;
  let vx = vel.x;
  let vy = vel.y;

  if (x < 0) {
    x = 0;
    vx = -vx * 0.6;
  } else if (x > 1) {
    x = 1;
    vx = -vx * 0.6;
  }
  if (y < 0) {
    y = 0;
    vy = -vy * 0.6;
  } else if (y > 1) {
    y = 1;
    vy = -vy * 0.6;
  }
  return { pos: { x, y }, vel: { x: vx, y: vy } };
}

/** 원-원 충돌(정규화 좌표). aspect 로 x축 왜곡 보정. */
export function collides(a: Vec, ar: number, b: Vec, br: number, aspect: number): boolean {
  const dx = (a.x - b.x) * aspect;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy) < ar + br;
}

/** 점수 → 획득 xp */
export function scoreToXp(collected: number, cfg: MinigameConfig): number {
  return collected * cfg.xpPerDebris;
}

/** xp → 레벨 (1 + floor(xp/100)) */
export function levelFromXp(xp: number): number {
  return 1 + Math.floor(xp / 100);
}
