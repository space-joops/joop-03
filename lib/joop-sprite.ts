// 줍스 캐릭터 스프라이트 시트 유틸 — public/game/joop-sheet.meta.json 계약의 코드 대응.
// 시트는 128px 프레임 6장(가로): idle [0,1] 2fps · move [2,3] 8fps · collect [4,5] 6fps.
// 순수 함수만 — 클라이언트/서버 어디서든 import 가능.

export type JoopSpriteState = "idle" | "move" | "collect";

export const JOOP_FRAME = 128;
/** 프레임 안에서 발(노즐 하단)의 y — 지상 배치는 이 지점을 땅에 맞춘다 (meta.anchorNote). */
export const JOOP_FEET_Y = 93;

export const JOOP_STATES: Record<JoopSpriteState, { frames: readonly number[]; fps: number }> = {
  idle: { frames: [0, 1], fps: 2 },
  move: { frames: [2, 3], fps: 8 },
  collect: { frames: [4, 5], fps: 6 },
};

/** 시트 색 변형 — 파일명 조각과 대표 hex (joop-sheet.meta.json colors). */
export const JOOP_SHEET_COLORS = {
  green: "#39ff14",
  amber: "#ffb000",
  cyan: "#2de2e6",
  magenta: "#ff2e97",
  lime: "#a0ff70",
  gold: "#ffd25e",
} as const;

export type JoopSheetName = keyof typeof JOOP_SHEET_COLORS;

export function joopSheetPath(name: JoopSheetName): string {
  return `/game/joop-sheet-${name}.png`;
}

function hueOf(hex: string): number {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) % 360 + 360) % 360;
}

/**
 * 줍스 색(hex) → 가장 가까운 시트 변형.
 * DB 팔레트(#35e07a 등)와 시트 팔레트(#39ff14 등)의 hex 가 정확히 일치하지 않아
 * 색상(hue) 원거리 최소로 매핑한다. 예: #35e07a→green, #ff5c77→magenta.
 */
export function sheetForColor(hex: string): JoopSheetName {
  const target = hueOf(hex);
  let best: JoopSheetName = "green";
  let bestDist = Infinity;
  for (const [name, sample] of Object.entries(JOOP_SHEET_COLORS) as [JoopSheetName, string][]) {
    const d = Math.abs(hueOf(sample) - target);
    const dist = Math.min(d, 360 - d);
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }
  return best;
}

/** 상태·경과시간 → 프레임 인덱스. reduced-motion 이면 상태의 첫 프레임 고정(meta 규칙). */
export function spriteFrame(state: JoopSpriteState, elapsed: number, reduceMotion: boolean): number {
  const s = JOOP_STATES[state];
  if (reduceMotion) return s.frames[0];
  return s.frames[Math.floor(elapsed * s.fps) % s.frames.length];
}
