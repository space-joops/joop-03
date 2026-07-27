// 궤도 좌표 계산 — 순수 함수(부수효과 없음).
// ⚠️ 서버(app/api/orbital/route.ts, lib/joops.ts)와 클라(components/orbital-canvas.tsx)가
//    이 파일을 동일하게 import 한다. 로직을 한 곳에 두어 서버 스냅샷과 클라 보간이 정확히 일치.
// 참고: docs/architecture/orbit-model.md
//
// 실제 궤도역학(케플러)에 뿌리를 두되 게임용으로 원궤도 근사로 단순화한다.
// 정밀 세차운동 등은 생략.

export type OrbitParams = {
  radius: number; // 궤도 반경(지구 반경 기준 정규화, 예: 1.15)
  inclination: number; // 궤도 경사 i (도)
  raan: number; // 승교점 경도 Ω (도)
  phase0: number; // 기준시각 t0에서의 궤도상 위상 φ₀ (rad)
  angularVelocity: number; // 각속도 ω (rad/s)
};

export type Vec3 = { x: number; y: number; z: number };
export type Vec2 = { x: number; y: number };

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/**
 * 시각 `tSeconds`(초)에서 줍스의 3D 궤도 위치.
 * `t0Seconds`는 서버 스냅샷의 기준시각(초). 서버·클라가 같은 값을 넣으면 같은 좌표가 나온다.
 *
 * φ(t) = φ₀ + ω·(t − t₀)
 * 궤도면: (r·cosφ, r·sinφ, 0) → 경사 i(x축 회전) → 승교점 Ω(z축 회전)
 */
export function positionAt(p: OrbitParams, tSeconds: number, t0Seconds: number): Vec3 {
  const phi = p.phase0 + p.angularVelocity * (tSeconds - t0Seconds);

  // 궤도면상 위치
  const xp = p.radius * Math.cos(phi);
  const yp = p.radius * Math.sin(phi);

  // 경사 i: x축 기준 회전
  const i = p.inclination * DEG;
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);
  const x1 = xp;
  const y1 = yp * cosI;
  const z1 = yp * sinI;

  // 승교점 Ω: z축 기준 회전
  const om = p.raan * DEG;
  const cosO = Math.cos(om);
  const sinO = Math.sin(om);

  return {
    x: x1 * cosO - y1 * sinO,
    y: x1 * sinO + y1 * cosO,
    z: z1,
  };
}

/**
 * 첫 화면 지구본을 정면에서 본 정사영(orthographic).
 * 반환 좌표는 지구 반경=1 기준의 정규화 평면 좌표. Canvas에서 스케일·중심 이동해 그린다.
 * `z`는 깊이(>0 앞쪽/지구 앞을 지나가는 중, <0 뒤쪽)로, 앞뒤 밝기·가림 표현에 쓸 수 있다.
 */
export function project2D(pos: Vec3): Vec2 {
  return { x: pos.x, y: pos.y };
}

export const EARTH_RADIUS_KM = 6371;

// ── 음영(그림자) 모델 ─────────────────────────────────────────
// 태양을 +x 방향으로 가정하므로 물리적 음영은 x(t) < 0 이다. 이 x 는 전개하면
//   x(t) = r·R·cos(φ(t) − ψ),   R = hypot(cos Ω, cos i·sin Ω),  ψ = atan2(−cos i·sin Ω, cos Ω)
// 즉 위상의 순수 사인파라서 **음영은 정확히 반주기**(비율 0.5)이고, 전환 시각을 수치 탐색 없이
// 해석적으로 구할 수 있다(검증: positionAt 과 오차 1e-13).
//
// 게임에서는 반주기(31~65분)를 기다릴 수 없으므로 두 손잡이를 둔다.
//   1) 음영 비율 fraction — 음영 호를 좁힌다(0.5 = 물리 그대로).
//   2) 게임 배속 — 시각 자체를 빠르게 돌린다(lib/orbit-clock.ts, config orbit_game_speed).

/** 음영 중심(가장 깊은 그늘)을 θ=π 로 두는 위상각 θ ∈ [0, 2π). */
function shadowTheta(p: OrbitParams, tSeconds: number): number {
  const psi = Math.atan2(
    -Math.cos(p.inclination * DEG) * Math.sin(p.raan * DEG),
    Math.cos(p.raan * DEG),
  );
  const theta = p.phase0 + p.angularVelocity * tSeconds - psi;
  return ((theta % TAU) + TAU) % TAU;
}

export type ShadowState = {
  inShadow: boolean;
  /** 다음 전환(음영→수신 또는 수신→음영)까지 남은 **게임 초** */
  gameSecondsToChange: number;
};

/**
 * 시각 t(게임 초)의 음영 여부와 다음 전환까지 남은 시간.
 * @param fraction 한 궤도 중 음영이 차지하는 비율(0~0.5). 0.5 면 물리 그대로(x<0)와 동일.
 */
export function shadowStateAt(
  p: OrbitParams,
  tSeconds: number,
  fraction: number,
): ShadowState {
  const f = Math.max(0, Math.min(0.5, fraction));
  const theta = shadowTheta(p, tSeconds);
  const half = Math.PI * f; // 음영 반폭(중심 π)
  const inShadow = Math.abs(theta - Math.PI) < half;
  // 음영이면 빠져나가는 각(π+half), 수신이면 들어가는 각(π−half)까지의 전진량
  const target = inShadow ? Math.PI + half : Math.PI - half;
  const dTheta = ((target - theta) % TAU + TAU) % TAU;
  const omega = Math.abs(p.angularVelocity) || 1e-9;
  return { inShadow, gameSecondsToChange: dTheta / omega };
}

/** 지구 자전 각속도(rad/s, 항성일 기준). 지상 궤적(ground track)의 서향 드리프트에 쓴다. */
export const EARTH_ROTATION_RAD_S = 7.2921159e-5;

export type GroundState = {
  latitude: number; // 도 (+N/−S)
  longitude: number; // 도 (+E/−W, −180~180) — 지구 자전 보정 후
  altitudeKm: number;
  speedKms: number;
  inShadow: boolean; // 음영(지구 그림자). lib/space.ts와 같은 규약: 태양 = +x → x<0이면 음영
};

/**
 * 시각 t의 지상 궤적(ground track) 상태 — 궤도 추적 모니터·계기판용.
 * positionAt은 관성 좌표(ECI)를 주므로, 경도는 지구 자전만큼 되돌려 지표 기준으로 만든다.
 * 고도·속도는 시간과 무관한 궤도 상수라 표시 배속의 영향을 받지 않는다.
 */
export function groundStateAt(p: OrbitParams, tSeconds: number): GroundState {
  const pos = positionAt(p, tSeconds, 0);
  const rMag = Math.hypot(pos.x, pos.y, pos.z) || p.radius;

  const latitude = (Math.asin(pos.z / rMag) * 180) / Math.PI;
  let longitude = ((Math.atan2(pos.y, pos.x) - EARTH_ROTATION_RAD_S * tSeconds) * 180) / Math.PI;
  longitude = ((longitude % 360) + 540) % 360 - 180; // −180~180 정규화

  return {
    latitude,
    longitude,
    altitudeKm: Math.round((p.radius - 1) * EARTH_RADIUS_KM),
    speedKms: Math.round(p.angularVelocity * p.radius * EARTH_RADIUS_KM * 10) / 10,
    inShadow: pos.x < 0,
  };
}
