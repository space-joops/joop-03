import { cache } from "react";
import { createSessionClient } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGameConfig } from "@/lib/game-config";
import { CONFIG_SPEC_BY_KEY, coerceConfigNumber } from "@/lib/config-specs";
import { positionAt, type OrbitParams } from "@/lib/orbit";

const EARTH_RADIUS_KM = 6371;

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
  };
});

export type OrbitState = {
  name: string;
  color: string;
  orbit: OrbitParams; // 클라 Canvas 보간용
  serverTime: number;
  altitudeKm: number;
  speedKms: number;
  latitude: number;
  longitude: number;
  inShadow: boolean; // 음영(지구 그림자) 여부
  totalCollected: number;
};

type JoopOrbitRow = {
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
      "name,color,status,orbit_radius,orbit_inclination,orbit_raan,orbit_phase0,orbit_angular_velocity,total_collected",
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

  const t = Date.now() / 1000;
  const pos = positionAt(orbit, t, 0);
  const rMag = Math.hypot(pos.x, pos.y, pos.z) || orbit.radius;

  const altitudeKm = Math.round((orbit.radius - 1) * EARTH_RADIUS_KM);
  const speedKms = Math.round(orbit.angularVelocity * orbit.radius * EARTH_RADIUS_KM * 10) / 10;
  const latitude = Math.round((Math.asin(pos.z / rMag) * 180) / Math.PI);
  const longitude = Math.round((Math.atan2(pos.y, pos.x) * 180) / Math.PI);
  const inShadow = pos.x < 0; // 태양을 +x 방향으로 가정 → 지구 뒤(-x)면 음영

  return {
    name: j.name,
    color: j.color,
    orbit,
    serverTime: Date.now(),
    altitudeKm,
    speedKms,
    latitude,
    longitude,
    inShadow,
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
