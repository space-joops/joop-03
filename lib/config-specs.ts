// joop_03_game_config 의 "알려진 키" 레지스트리 — 순수 모듈(클라이언트에서 import 해도 안전).
//
// value 가 jsonb 라 자유 텍스트로 편집하게 두면 오타 하나로 게임이 망가진다.
//   - orbital_tick_seconds = 0  → /api/orbital 폴링 폭주
//   - minigame_fuel = -1        → 게임 시작 즉시 종료
//   - minigame_max_speed = 0    → 조작 불가
//   - minigame_xp_per_debris 가 과도하게 크면 joop_03_joops.xp(int4, 최대 21.4억) 오버플로
// 그래서 키마다 타입·범위·라벨·설명을 코드에 두고 서버에서 검증한다.
//
// ⚠️ xp 오버플로 방어: max_debris_per_run(≤5000) × xp_per_debris(≤1000) = 500만 이므로
//    한 판 최대 XP 가 int4 안에 넉넉히 들어온다. 두 키의 max 는 함께 조정해야 한다.

export type ConfigGroup = "orbital" | "minigame" | "launch";

export type ConfigSpec = {
  key: string;
  label: string;
  description: string;
  group: ConfigGroup;
  type: "int" | "float";
  min: number;
  max: number;
  step: number;
  unit?: string;
  fallback: number;
  /** 값이 게임 시작 시점에 고정되는 키 — "게임 재시작 시 반영"(FR-10.2/FR-7.5) */
  restartRequired?: boolean;
  /** 잘못 올리면 위험한 키 — 화면에서 경고 톤으로 표시 */
  warn?: string;
};

export const CONFIG_GROUP_LABELS: Record<ConfigGroup, string> = {
  orbital: "궤도 · 첫 화면",
  minigame: "미니게임 물리",
  launch: "발사",
};

export const CONFIG_SPECS: readonly ConfigSpec[] = [
  {
    key: "orbital_tick_seconds",
    label: "좌표 스냅샷 주기",
    description:
      "첫 화면 궤도 좌표를 서버에서 다시 계산하는 간격. 클라이언트 폴링 간격과 CDN 캐시 수명이 이 값을 따릅니다.",
    group: "orbital",
    type: "int",
    min: 5,
    max: 300,
    step: 1,
    unit: "초",
    fallback: 10,
  },
  {
    key: "debris_target",
    label: "전체 청소 목표",
    description: "첫 화면의 청소 완료 퍼센트를 계산하는 기준 조각 수입니다.",
    group: "orbital",
    type: "int",
    min: 1,
    max: 1_000_000_000_000,
    step: 1,
    unit: "조각",
    fallback: 5_000_000,
  },
  {
    key: "minigame_thrust",
    label: "추력(가속)",
    description: "화면을 눌렀을 때 줍스가 얻는 가속량. 클수록 조작이 민감해집니다.",
    group: "minigame",
    type: "float",
    min: 0.01,
    max: 5,
    step: 0.01,
    fallback: 0.35,
    restartRequired: true,
  },
  {
    key: "minigame_max_speed",
    label: "최대 속도",
    description: "속도 상한. 이 값을 넘으면 방향은 유지한 채 크기만 잘립니다.",
    group: "minigame",
    type: "float",
    min: 0.5,
    max: 50,
    step: 0.1,
    fallback: 6,
    restartRequired: true,
  },
  {
    key: "minigame_fuel",
    label: "초기 연료(분사가스)",
    description: "한 판에 주어지는 분사가스. 다 쓰면 게임이 끝납니다(FR-7.6).",
    group: "minigame",
    type: "float",
    min: 10,
    max: 1000,
    step: 1,
    fallback: 100,
    restartRequired: true,
  },
  {
    key: "minigame_friction",
    label: "마찰",
    description:
      "0이면 관성이 유지됩니다(FR-7.5의 기본값). 0보다 크면 손을 뗐을 때 서서히 감속합니다.",
    group: "minigame",
    type: "float",
    min: 0,
    max: 0.5,
    step: 0.001,
    fallback: 0,
    restartRequired: true,
  },
  {
    key: "minigame_xp_per_debris",
    label: "쓰레기당 XP",
    description: "수거 1개당 부여할 경험치. 서버가 이 값으로 XP를 계산합니다(레벨 = 1 + XP/100).",
    group: "minigame",
    type: "int",
    min: 1,
    max: 1000,
    step: 1,
    fallback: 8,
  },
  {
    key: "minigame_max_debris_per_run",
    label: "한 판 최대 인정 수거",
    description: "클라이언트가 보고한 수거 개수의 상한. 이 값을 넘는 결과는 조작으로 보고 버립니다.",
    group: "minigame",
    type: "int",
    min: 1,
    max: 5000,
    step: 1,
    fallback: 300,
    warn: "올릴수록 클라이언트 조작 여지가 커집니다. 연료를 크게 늘렸을 때만 함께 올리세요.",
  },
  {
    key: "launch_required_level",
    label: "기본 발사 자격 레벨",
    description: "새 발사체를 등록할 때 채워지는 필요 레벨 기본값입니다. 발사체별로 따로 정할 수 있습니다.",
    group: "launch",
    type: "int",
    min: 1,
    max: 100,
    step: 1,
    fallback: 3,
  },
];

export const CONFIG_SPEC_BY_KEY = new Map(CONFIG_SPECS.map((spec) => [spec.key, spec]));

export type ParseResult =
  | { ok: true; value: number }
  | { ok: false; error: "empty" | "type" | "range" };

/** 폼 문자열 → 숫자 검증. 서버 검증이 본체이고, 클라이언트는 즉시 피드백용으로 같은 함수를 쓴다. */
export function parseConfigValue(spec: ConfigSpec, raw: string): ParseResult {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, error: "empty" };

  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { ok: false, error: "type" };
  if (spec.type === "int" && !Number.isInteger(n)) return { ok: false, error: "type" };
  if (n < spec.min || n > spec.max) return { ok: false, error: "range" };

  return { ok: true, value: n };
}

/** DB 값이 스펙 범위를 벗어나면(직접 SQL 로 넣은 경우 등) 조용히 폴백을 쓴다. */
export function coerceConfigNumber(spec: ConfigSpec, value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < spec.min || n > spec.max) return spec.fallback;
  if (spec.type === "int" && !Number.isInteger(n)) return spec.fallback;
  return n;
}
