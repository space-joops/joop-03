/**
 * 줍스 6색 팔레트 — 단일 출처.
 *
 * 값의 원본은 디자이너 납품물 `public/game/joop-sheet.meta.json` 의 `colors`
 * (docs/design/handoff-m2.md §2). 키는 스프라이트 시트 파일명 접미사와 같다:
 *   green → public/game/joop-sheet-green.png
 *
 * `public/` 은 번들러 입력이 아니라 정적 서빙 대상이고, JSON import 는 리터럴 타입을
 * 잃어 `JoopColorName` 유니온이 만들어지지 않으므로 TS 상수로 옮겨 둔다.
 * meta.json 을 바꾸면 이 파일도 함께 바꿔야 한다.
 *
 * ⚠️ M1 시드로 들어간 NPC 줍스 100개의 color 는 아직 구 hex(#00e5ff 등)를 쓴다.
 *    데이터 정합화는 별도 작업(마이그레이션 필요).
 */
export const JOOP_COLORS = {
  green: "#39ff14",
  amber: "#ffb000",
  cyan: "#2de2e6",
  magenta: "#ff2e97",
  lime: "#a0ff70",
  gold: "#ffd25e",
} as const;

export type JoopColorName = keyof typeof JOOP_COLORS;

export const JOOP_COLOR_NAMES = Object.keys(JOOP_COLORS) as JoopColorName[];

export const DEFAULT_JOOP_COLOR: JoopColorName = "green";

/** 저장/전송되는 값은 hex. 서버 검증에 쓴다. */
export const JOOP_COLOR_HEXES: string[] = JOOP_COLOR_NAMES.map((n) => JOOP_COLORS[n]);

export function joopColorHex(name: JoopColorName): string {
  return JOOP_COLORS[name];
}

/** hex → 색 이름. 구 팔레트 등 목록에 없는 값이면 null. */
export function joopColorNameOf(hex: string): JoopColorName | null {
  const lower = hex.toLowerCase();
  return JOOP_COLOR_NAMES.find((n) => JOOP_COLORS[n] === lower) ?? null;
}
