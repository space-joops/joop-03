# 궤도 좌표 모델 — 서버/클라 공유 계산

> 대상: FR-1.3, FR-1.4. 이슈 원문: "좌표는 서버에서 10초에 한 번 계산되어 API로 제공 … 클라이언트는 같은 계산 로직으로 좌표를 계산 … 실공식에 기반을 두지만 게임 특성상 단순화."

## 설계 원칙

1. **단순화된 물리**: 실제 궤도역학(케플러)에 뿌리를 두되, 게임용으로 **원궤도 근사**로 단순화한다. 정밀도보다 "그럴듯함 + 가벼움"이 목표.
2. **순수 함수로 공유**: 좌표 계산은 부수효과 없는 순수 함수 `lib/orbit.ts`로 두고, **서버 route와 클라 Canvas 컴포넌트가 동일하게 import**(`@/lib/orbit`). 로직 중복·불일치를 원천 차단.
3. **스냅샷 + 보간**: 서버는 10초마다 "기준 스냅샷"만 제공하고, 클라는 같은 공식으로 프레임마다 현재 시각을 대입해 부드럽게 렌더 → **서버 부하 최소화**(이슈 요구).

## 줍스 궤도 파라미터

각 줍스는 아래 파라미터로 표현된다(→ [data-model](./data-model.md) `joop_03_joops`).

| 파라미터 | 의미 | 단위 |
|---|---|---|
| `orbit_radius` | 궤도 반경(지구 반경 기준 정규화 고도) | 배수 |
| `orbit_inclination` (i) | 궤도 경사 | 도(°) |
| `orbit_raan` (Ω) | 승교점 경도 | 도(°) |
| `orbit_phase0` (φ₀) | 기준시각 t₀에서의 궤도상 위상 | rad |
| `orbit_angular_velocity` (ω) | 각속도 | rad/s |

## 좌표 공식 (초안)

시각 `t`(초)에서 줍스의 궤도상 위상:

```
φ(t) = φ₀ + ω · (t − t₀)
```

원궤도 평면상의 위치(궤도면 기준):

```
x' = r · cos(φ)
y' = r · sin(φ)
z' = 0
```

경사 `i`와 승교점 `Ω`로 3D 회전 후, 첫 화면은 이를 **2D로 정사영**하여 지구본 위에 표시한다. (정밀 세차운동 등은 생략. 필요 시 후속 확장.)

```
lib/orbit.ts (의사 시그니처)
────────────────────────────
export type OrbitParams = {
  radius: number; inclination: number; raan: number;
  phase0: number; angularVelocity: number;
}
// 순수 함수: 서버·클라 공용
export function positionAt(p: OrbitParams, tSeconds: number, t0Seconds: number): { x: number; y: number; z: number }
export function project2D(pos3d): { x: number; y: number }   // 첫 화면 지구본 투영
```

## 시간 동기화

- 서버 스냅샷에 `serverTime`(ms epoch)을 포함해 클라가 자신의 시계 오차를 보정한다(클라 시계가 틀려도 궤도가 튀지 않게).
- 클라는 `t = serverTime/1000 + (performance.now 기반 경과)`로 현재 시각을 추정해 `positionAt`에 대입.
- **비결정 연산 주의**(커스텀 Next.js): 서버 계산에 `Date.now()`가 들어가면, Cache Components를 켤 경우 `connection()`/`Suspense` 처리가 필요하다. 현재는 Cache Components 미사용 + `revalidate=10`이라 route에서 직접 계산해도 된다. → [ADR-0005](./adr/0005-ssr-orbital-api.md)

## 튜닝 포인트 (관리자 파라미터 후보, EPIC 10)

- 좌표 계산/스냅샷 주기: `joop_03_game_config.orbital_tick_seconds`(기본 10).
- 궤도 속도 스케일(게임 체감 속도), 표시 줍스 수(기본 100).

## 검증 방법(구현 시)

- 서버 스냅샷의 `t₀`로 클라가 계산한 좌표가 다음 스냅샷 시점에 서버 값과 **오차 없이 수렴**하는지 확인(같은 순수 함수이므로 일치해야 함).
- 100개 60fps 프로파일링.
