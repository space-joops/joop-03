import "server-only";
import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_CONFIG, type MinigameConfig } from "@/lib/minigame";
import { CONFIG_SPEC_BY_KEY, coerceConfigNumber } from "@/lib/config-specs";

// joop_03_game_config 조회를 한곳으로 모은다.
// 이전에는 lib/joops.ts 가 직접 조회하고 폴백 상수를 따로 들고 있어 이중 관리였다.
// 폴백의 단일 진실은 lib/config-specs.ts 의 spec.fallback 이다.

export type GameConfigRow = { key: string; value: unknown; updatedAt: string };

type Row = { key: string; value: unknown; updated_at: string };

/** 전체 config. React.cache 라 같은 요청 안에서는 한 번만 조회한다. */
export const getGameConfig = cache(async (): Promise<Map<string, unknown>> => {
  const sb = createServerClient();
  const { data, error } = await sb.from("joop_03_game_config").select("key,value,updated_at");
  if (error) throw error;
  return new Map(((data ?? []) as Row[]).map((r) => [r.key, r.value]));
});

/** 관리자 화면용 — 레지스트리에 없는 키까지 원본 그대로. */
export const getGameConfigRows = cache(async (): Promise<GameConfigRow[]> => {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("joop_03_game_config")
    .select("key,value,updated_at")
    .order("key");
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({
    key: r.key,
    value: r.value,
    updatedAt: r.updated_at,
  }));
});

function num(config: Map<string, unknown>, key: string): number {
  const spec = CONFIG_SPEC_BY_KEY.get(key);
  if (!spec) throw new Error(`알 수 없는 config 키: ${key}`);
  if (!config.has(key)) return spec.fallback;
  return coerceConfigNumber(spec, config.get(key));
}

/** DB 값을 DEFAULT_CONFIG 위에 덮어쓴 지상 훈련 미니게임 설정. */
export async function getMinigameConfig(): Promise<MinigameConfig> {
  const config = await getGameConfig();
  return {
    ...DEFAULT_CONFIG,
    moveSpeed: num(config, "minigame_move_speed"),
    fallSpeed: num(config, "minigame_fall_speed"),
    fallRamp: num(config, "minigame_fall_ramp"),
    spawnInterval: num(config, "minigame_spawn_interval"),
    hazardRatio: num(config, "minigame_hazard_ratio"),
    lives: num(config, "minigame_lives"),
    duration: num(config, "minigame_duration_seconds"),
    xpPerDebris: num(config, "minigame_xp_per_debris"),
  };
}

/** 클라이언트가 보고한 수거 개수의 신뢰 상한(치팅 방어선). */
export async function getMaxDebrisPerRun(): Promise<number> {
  return num(await getGameConfig(), "minigame_max_debris_per_run");
}

/** 새 발사체 등록 시 채워질 필요 레벨 기본값. */
export async function getDefaultRequiredLevel(): Promise<number> {
  return num(await getGameConfig(), "launch_required_level");
}
