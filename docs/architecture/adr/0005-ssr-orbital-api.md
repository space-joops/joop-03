# ADR-0005 · SSR 궤도 좌표 API (10초 주기)

- 상태: 제안됨(Proposed)
- 관련: FR-1.3, FR-1.4, FR-10.1 · 상세 공식: [orbit-model](../orbit-model.md)

## 배경 / 문제

첫 화면의 줍스 100개 좌표를 **서버에서 10초(설정 가능)마다 계산**해 API로 제공하고, **클라이언트는 동일 로직으로 보간**해야 한다(부하 최소화). 이 프로젝트의 커스텀 Next.js 16.2.12는 캐싱·렌더링 모델이 표준과 다르다.

## 결정

**레거시 캐싱 모델**(현재 `next.config.ts`에 `cacheComponents` 미설정)에 맞춰 Route Handler + 세그먼트 `revalidate`를 사용한다.

- **엔드포인트**: `app/api/orbital/route.ts` 가 `GET`을 export, `Response.json(...)` 반환.
- **주기**: `export const revalidate = 10` (정적 분석 가능한 리터럴). 계산 주기 자체는 `joop_03_game_config.orbital_tick_seconds`(기본 10)에서 읽어 응답에 `tickSeconds`로 실어 보낸다.
- **계산 로직 공유**: `lib/orbit.ts`(순수 함수)를 route와 클라 Canvas 컴포넌트가 동일 import. 서버는 기준 스냅샷(`serverTime`, `t0`, 각 줍스 파라미터, 누적 집계)만 제공.
- **클라 보간**: 클라는 같은 순수 함수로 `t0→현재`를 프레임마다 계산(rAF). 다음 스냅샷이 오면 서버 값과 수렴.
- **응답 형태**: [screens/01-first-screen.md](../../product/screens/01-first-screen.md)의 API 예시 참조.

## 대안 / 주의

- **Cache Components(`cacheComponents: true`)로 전환** 시: `use cache` + `cacheLife({ revalidate: 10 })`(route 본문이 아니라 헬퍼에), 그리고 route-segment `revalidate`는 **제거**된다. 10초는 "short-lived" 캐시로 분류되어 prerender에서 제외(dynamic hole), `<Suspense>` 래핑 필요. 또한 Vercel 서버리스에서 in-memory 캐시는 요청 간 유지 안 될 수 있어 `use cache: remote` 고려. → 초기엔 켜지 않는다.
- **비결정 연산**: 서버 계산에 `Date.now()` 사용. 레거시 모델에선 route에서 직접 계산 OK. 향후 Cache Components 전환 시 `connection()`/`Suspense` 처리 필요.
- **정적 vs 동적**: 순수 계산이라 `dynamic = 'force-static'` + `revalidate=10`으로 ISR화할 수도, 매 요청 동적 계산으로 둘 수도 있다. 부하·정합성 트레이드오프는 M1에서 실측 후 확정.

## 영향

- `lib/orbit.ts` 순수 함수 계약이 서버·클라 양쪽의 단일 진실.
- 관리자 파라미터(`orbital_tick_seconds`)를 초기부터 config로 읽어 EPIC 10과 연결.
- 스냅샷에 `serverTime`을 포함해 클라 시계 오차 보정.

## 미해결

- ISR(force-static) vs 순수 동적 최종 선택(M1 실측).
- 100개 초과 확장 시 페이로드/샤딩.
