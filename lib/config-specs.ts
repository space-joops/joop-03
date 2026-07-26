// joop_03_game_config 의 "알려진 키" 레지스트리 — 순수 모듈(클라이언트에서 import 해도 안전).
//
// value 가 jsonb 라 자유 텍스트로 편집하게 두면 오타 하나로 게임이 망가진다.
//   - orbital_tick_seconds = 0    → /api/orbital 폴링 폭주
//   - minigame_lives = 0          → 게임 시작 즉시 종료
//   - minigame_move_speed = 0     → 조작 불가
//   - minigame_hazard_ratio = 1   → 받아낼 쓰레기가 아예 안 나옴
//   - minigame_xp_per_debris 가 과도하게 크면 joop_03_joops.xp(int4, 최대 21.4억) 오버플로
// 그래서 키마다 타입·범위·라벨·설명을 코드에 두고 서버에서 검증한다.
//
// ⚠️ xp 오버플로 방어: max_debris_per_run(≤5000) × xp_per_debris(≤1000) = 500만 이므로
//    한 판 최대 XP 가 int4 안에 넉넉히 들어온다. 두 키의 max 는 함께 조정해야 한다.

export type ConfigGroup = "orbital" | "minigame" | "space" | "launch";

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
  minigame: "지상 훈련 미니게임",
  space: "우주 지도 · 자동 수거",
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
    key: "minigame_move_speed",
    label: "좌우 이동 속도",
    description:
      "줍스가 1초에 화면 폭의 몇 배를 움직이는지. 0.85면 화면을 가로지르는 데 약 1.2초 걸립니다.",
    group: "minigame",
    type: "float",
    min: 0.1,
    max: 3,
    step: 0.05,
    unit: "화면폭/초",
    fallback: 0.85,
    restartRequired: true,
  },
  {
    key: "minigame_fall_speed",
    label: "낙하 속도",
    description: "물체가 1초에 화면 높이의 몇 배를 내려오는지(시작값). 클수록 반응 시간이 짧아집니다.",
    group: "minigame",
    type: "float",
    min: 0.05,
    max: 2,
    step: 0.01,
    unit: "화면높이/초",
    fallback: 0.3,
    restartRequired: true,
  },
  {
    key: "minigame_fall_ramp",
    label: "난이도 상승 계수",
    description:
      "경과 시간에 비례해 낙하 속도를 올리고 생성 간격을 줄입니다. 0이면 처음 난이도가 끝까지 유지됩니다.",
    group: "minigame",
    type: "float",
    min: 0,
    max: 0.1,
    step: 0.001,
    unit: "/초",
    fallback: 0.012,
    restartRequired: true,
  },
  {
    key: "minigame_spawn_interval",
    label: "물체 생성 간격",
    description: "새 물체가 떨어지는 간격(시작값). 난이도 상승 계수에 따라 점점 짧아집니다(하한 0.28초).",
    group: "minigame",
    type: "float",
    min: 0.2,
    max: 5,
    step: 0.05,
    unit: "초",
    fallback: 0.85,
    restartRequired: true,
  },
  {
    key: "minigame_hazard_ratio",
    label: "위험물 비율",
    description:
      "떨어지는 물체 중 '충돌하면 안 되는' 작동 중인 위성의 비율입니다. 나머지는 받아내야 하는 쓰레기입니다.",
    group: "minigame",
    type: "float",
    min: 0,
    max: 0.8,
    step: 0.01,
    fallback: 0.35,
    restartRequired: true,
    warn: "0.8에 가까우면 받아낼 쓰레기가 거의 안 나와 XP를 벌 수 없습니다.",
  },
  {
    key: "minigame_lives",
    label: "내구도",
    description: "위성과 이 횟수만큼 부딪히면 훈련이 끝납니다.",
    group: "minigame",
    type: "int",
    min: 1,
    max: 10,
    step: 1,
    unit: "회",
    fallback: 3,
    restartRequired: true,
  },
  {
    key: "minigame_duration_seconds",
    label: "훈련 제한 시간",
    description: "한 판의 길이. 시간이 끝나거나 내구도가 소진되면 결과 화면으로 넘어갑니다.",
    group: "minigame",
    type: "int",
    min: 15,
    max: 300,
    step: 5,
    unit: "초",
    fallback: 60,
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
    fallback: 25,
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
    warn: "올릴수록 클라이언트 조작 여지가 커집니다. 제한 시간을 크게 늘렸을 때만 함께 올리세요.",
  },
  {
    key: "idle_collect_rate",
    label: "자동 수거 속도",
    description:
      "궤도의 줍스가 음영 지역에서 자동으로 줍는 시간당 조각 수입니다(FR-6.1). 방치형 진행 속도를 좌우합니다.",
    group: "space",
    type: "int",
    min: 0,
    max: 100_000,
    step: 10,
    unit: "조각/시간",
    fallback: 120,
  },
  {
    key: "idle_collect_cap_hours",
    label: "자동 수거 정산 상한",
    description:
      "한 번 정산할 때 반영할 최대 경과 시간. 오래 접속하지 않아도 이 시간까지만 쌓입니다.",
    group: "space",
    type: "int",
    min: 1,
    max: 168,
    step: 1,
    unit: "시간",
    fallback: 12,
  },
  {
    key: "launch_countdown_seconds",
    label: "발사 카운트다운",
    description: "탑승 확정 후 발사 시퀀스 카운트다운 길이입니다(FR-5.1).",
    group: "launch",
    type: "int",
    min: 3,
    max: 60,
    step: 1,
    unit: "초",
    fallback: 8,
    restartRequired: true,
  },
  {
    key: "launch_required_level",
    label: "기본 발사 자격 레벨",
    description:
      "새 발사체를 등록할 때 채워지는 필요 레벨 기본값입니다. 발사체별로 따로 정할 수 있습니다. " +
      "테스트 기간이라 1로 낮춰 두었습니다 — 정식 운영 시 올려야 합니다.",
    group: "launch",
    type: "int",
    min: 1,
    max: 100,
    step: 1,
    fallback: 1,
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
