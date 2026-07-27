// 궤도 표시용 가상 시계 — 클라이언트 전용(Date.now 사용).
//
// 첫 화면의 배속은 "표시 전용"이다. positionAt(orbit, t·배속, 0) 처럼 절대 시각에
// 배속을 곱하면 배속을 바꾸는 순간 위상이 수천 라디안 점프하므로, 대신 가상 시각 vt를
// 프레임마다 (실경과시간 × 배속)만큼 전진시킨다 → 배속 변경·뷰 전환에도 위치가 연속.
//
// 초기값은 실제 현재 시각이라 배속 1×로 두면 서버(lib/space.ts)가 계산하는 실위치와
// 일치한다. 시계는 ref 로 들고 지구본/추적 뷰가 같은 인스턴스를 공유한다.

export type OrbitClock = {
  /** 가상 시각(초). positionAt 의 tSeconds 로 그대로 쓴다. */
  vt: number;
  /** 마지막 tick 의 실제 시각(초). null 이면 아직 tick 전. */
  lastReal: number | null;
};

/**
 * @param gameSpeed 궤도 게임 배속(config orbit_game_speed).
 * @param anchorMs  기준 실시각(epoch ms). **스냅샷의 serverTime 을 넘겨라** —
 *   서버·클라가 같은 값에서 출발하므로 (1) 첫 렌더가 결정적이어서 하이드레이션 불일치가 없고,
 *   (2) 클라 시계가 틀어져 있어도 서버 기준 위상을 따라간다(orbit-model.md 의 시계 보정).
 *   생략하면 로컬 시계를 쓴다(하네스·단독 사용).
 */
export function createOrbitClock(gameSpeed = 1, anchorMs?: number): OrbitClock {
  return { vt: ((anchorMs ?? Date.now()) / 1000) * gameSpeed, lastReal: null };
}

/**
 * 한 프레임 전진. 탭 복귀 등으로 실경과가 길어도 0.5초로 잘라
 * 고배속에서 갑자기 수십 바퀴 점프하는 것을 막는다.
 */
export function tickOrbitClock(clock: OrbitClock, speed: number): number {
  const real = Date.now() / 1000;
  if (clock.lastReal !== null) {
    clock.vt += Math.min(Math.max(real - clock.lastReal, 0), 0.5) * speed;
  }
  clock.lastReal = real;
  return clock.vt;
}
