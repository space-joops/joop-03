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
