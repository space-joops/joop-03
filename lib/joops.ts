import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { getGameConfig } from "@/lib/game-config";
import { CONFIG_SPEC_BY_KEY, coerceConfigNumber } from "@/lib/config-specs";
import type { OrbitParams } from "@/lib/orbit";

// /api/orbital 응답 = 첫 화면 스냅샷.
// 형태는 docs/product/screens/01-first-screen.md 의 JSON 계약과 일치.
export type JoopSnapshot = {
  id: string;
  name: string;
  color: string;
  orbit: OrbitParams;
  collected: number;
};

export type OrbitalSnapshot = {
  serverTime: number; // ms epoch. 클라가 t0(보간 기준시각)로 사용 + 시계 보정
  tickSeconds: number; // 좌표 스냅샷 주기(초). joop_03_game_config.orbital_tick_seconds
  totals: { debris: number; percent: number; target: number };
  joops: JoopSnapshot[];
};

type JoopRow = {
  id: string;
  name: string;
  color: string;
  orbit_radius: number;
  orbit_inclination: number;
  orbit_raan: number;
  orbit_phase0: number;
  orbit_angular_velocity: number;
  total_collected: number;
};

/** config 폴백의 단일 진실은 lib/config-specs.ts 이므로 여기서 상수를 따로 두지 않는다. */
function configNumber(config: Map<string, unknown>, key: string): number {
  const spec = CONFIG_SPEC_BY_KEY.get(key)!;
  return config.has(key) ? coerceConfigNumber(spec, config.get(key)) : spec.fallback;
}

/**
 * 궤도 스냅샷을 계산한다. 서버 컴포넌트(초기 SSR)와 /api/orbital 라우트가 공유한다.
 * `React.cache` 로 같은 요청 안에서는 한 번만 조회.
 *
 * ⚠️ serverTime = Date.now() 는 비결정 값이다. /api/orbital 이 이 스냅샷을
 *    `tickSeconds` 동안 CDN 캐시로 고정하며, 그게 곧 "N초마다 새 스냅샷" 설계다
 *    (docs/architecture/adr/0005-ssr-orbital-api.md).
 */
export const getOrbitalSnapshot = cache(async (): Promise<OrbitalSnapshot> => {
  const sb = createServerClient();

  const [joopsRes, config] = await Promise.all([
    sb
      .from("joop_03_joops")
      .select(
        "id,name,color,orbit_radius,orbit_inclination,orbit_raan,orbit_phase0,orbit_angular_velocity,total_collected",
      )
      .eq("status", "orbit")
      .order("name"),
    getGameConfig(),
  ]);

  if (joopsRes.error) throw joopsRes.error;

  const tickSeconds = configNumber(config, "orbital_tick_seconds");
  const target = configNumber(config, "debris_target");

  const rows = (joopsRes.data ?? []) as JoopRow[];
  const debris = rows.reduce((sum, j) => sum + Number(j.total_collected), 0);

  return {
    serverTime: Date.now(),
    tickSeconds,
    totals: {
      debris,
      percent: target > 0 ? (debris / target) * 100 : 0,
      target, // 게이지에 "N / 목표" 를 보여주기 위해 함께 내린다(UX 리뷰)
    },
    joops: rows.map((j) => ({
      id: j.id,
      name: j.name,
      color: j.color,
      orbit: {
        radius: Number(j.orbit_radius),
        inclination: Number(j.orbit_inclination),
        raan: Number(j.orbit_raan),
        phase0: Number(j.orbit_phase0),
        angularVelocity: Number(j.orbit_angular_velocity),
      },
      collected: Number(j.total_collected),
    })),
  };
});
