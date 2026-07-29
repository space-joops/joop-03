import { cache } from "react";
import { createSessionClient } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGameConfig } from "@/lib/game-config";
import { CONFIG_SPEC_BY_KEY, coerceConfigNumber } from "@/lib/config-specs";
import { groundStateAt, shadowStateAt, type OrbitParams } from "@/lib/orbit";

// 운영 파라미터(숫자) 읽기 — 공개 config.
// 폴백 기본값은 lib/config-specs.ts 의 spec.fallback 이 단일 진실이다(관리자 콘솔이 쓰는 값과 동일).
export const getSpaceConfig = cache(async () => {
  const config = await getGameConfig();
  const num = (key: string) => {
    const spec = CONFIG_SPEC_BY_KEY.get(key)!;
    return config.has(key) ? coerceConfigNumber(spec, config.get(key)) : spec.fallback;
  };
  return {
    idleCollectRate: num("idle_collect_rate"), // 시간당 조각
    idleCollectCapHours: num("idle_collect_cap_hours"),
    launchCountdownSeconds: num("launch_countdown_seconds"),
    launchSequenceSeconds: num("launch_sequence_seconds"),
    orbitGameSpeed: num("orbit_game_speed"), // 궤도 위상 진행 배속(클라 렌더와 공유)
    shadowFraction: num("shadow_fraction"), // 한 궤도 중 음영 비율
  };
});

/** 실시각 → 게임 시각(초). 서버·클라가 같은 식을 쓰므로 음영 상태와 화면이 일치한다. */
export function gameTimeSeconds(gameSpeed: number, nowMs = Date.now()): number {
  return (nowMs / 1000) * gameSpeed;
}

export type OrbitState = {
  id: string;
  name: string;
  color: string;
  orbit: OrbitParams; // 클라 Canvas 보간용
  serverTime: number;
  altitudeKm: number;
  speedKms: number;
  latitude: number;
  longitude: number;
  inShadow: boolean; // 음영(지구 그림자) 여부
  /** 음영↔수신이 다음에 바뀌는 실제 시각(epoch ms) — 클라가 카운트다운에 쓴다 */
  nextChangeAt: number;
  /** 궤도 게임 배속 — 클라 렌더가 서버와 같은 위상을 쓰도록 내려보낸다 */
  gameSpeed: number;
  totalCollected: number;
};

type JoopOrbitRow = {
  id: string;
  name: string;
  color: string;
  status: string;
  orbit_radius: number;
  orbit_inclination: number;
  orbit_raan: number;
  orbit_phase0: number;
  orbit_angular_velocity: number;
  total_collected: number;
};

// 내 궤도 줍스의 현재 상태(위치·속도·고도·상공·음영). orbit 아니면 null.
export async function getMyOrbitState(): Promise<OrbitState | null> {
  const sb = await createSessionClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data } = await sb
    .from("joop_03_joops")
    .select(
      "id,name,color,status,orbit_radius,orbit_inclination,orbit_raan,orbit_phase0,orbit_angular_velocity,total_collected",
    )
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data) return null;
  const j = data as JoopOrbitRow;
  if (j.status !== "orbit") return null;

  const orbit: OrbitParams = {
    radius: Number(j.orbit_radius),
    inclination: Number(j.orbit_inclination),
    raan: Number(j.orbit_raan),
    phase0: Number(j.orbit_phase0),
    angularVelocity: Number(j.orbit_angular_velocity),
  };

  // 위치·음영은 **게임 시각**으로 계산한다(클라 지구본/추적 지도와 같은 위상).
  // 고도·속도는 궤도 상수라 배속과 무관한 실물리값이다.
  const cfg = await getSpaceConfig();
  const now = Date.now();
  const t = gameTimeSeconds(cfg.orbitGameSpeed, now);
  const ground = groundStateAt(orbit, t);
  const shadow = shadowStateAt(orbit, t, cfg.shadowFraction);

  return {
    id: j.id,
    name: j.name,
    color: j.color,
    orbit,
    serverTime: now,
    altitudeKm: ground.altitudeKm,
    speedKms: ground.speedKms,
    latitude: Math.round(ground.latitude),
    longitude: Math.round(ground.longitude),
    inShadow: shadow.inShadow,
    // 게임 초 → 실초 환산 후 절대 시각으로. 클라는 이 값만으로 카운트다운할 수 있다.
    nextChangeAt: now + (shadow.gameSecondsToChange / cfg.orbitGameSpeed) * 1000,
    gameSpeed: cfg.orbitGameSpeed,
    totalCollected: Number(j.total_collected),
  };
}

// idle 자동 수거 정산: 마지막 정산 이후 경과 × 수거율 → debris_events + total_collected 갱신.
// 반환: 이번에 수거한 양(조각).
export async function settleIdleCollection(): Promise<number> {
  const sb = await createSessionClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return 0;

  const admin = createAdminClient();
  const { data: joop } = await admin
    .from("joop_03_joops")
    .select("id,status,total_collected,last_collected_at")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!joop || joop.status !== "orbit") return 0;

  const cfg = await getSpaceConfig();
  const now = Date.now();
  const last = joop.last_collected_at ? new Date(joop.last_collected_at).getTime() : now;
  const capMs = cfg.idleCollectCapHours * 3600 * 1000;
  const elapsedMs = Math.min(now - last, capMs);
  const collected = Math.floor((elapsedMs / 3600000) * cfg.idleCollectRate);

  if (collected <= 0) {
    // 경과가 짧아도 기준 시각은 갱신하지 않음(누적 손실 방지)
    return 0;
  }

  await admin.from("joop_03_debris_events").insert({
    joop_id: joop.id,
    amount: collected,
    occurred_at: new Date(now).toISOString(),
  });
  await admin
    .from("joop_03_joops")
    .update({
      total_collected: Number(joop.total_collected) + collected,
      last_collected_at: new Date(now).toISOString(),
    })
    .eq("id", joop.id);

  return collected;
}
