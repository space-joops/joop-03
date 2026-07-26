# M1 · 첫 화면 (궤도 대시보드) — 상세 스펙

> 대상 에픽: [EPIC 1](../requirements.md#epic-1--첫-화면--궤도-대시보드-mvp-첫째-화면). 이 문서는 다음 세션이 곧바로 구현에 착수할 수 있는 수준의 스펙입니다.
> 관련: [orbit-model](../../architecture/orbit-model.md) · [data-model](../../architecture/data-model.md) · [ADR-0005 SSR 궤도 API](../../architecture/adr/0005-ssr-orbital-api.md) · [ADR-0003 Canvas 2D](../../architecture/adr/0003-rendering-canvas2d.md)

## 목표

로그인하지 않아도 볼 수 있는 공개 랜딩. 지구 궤도를 도는 **줍스 100개**가 실시간으로 움직이고, 전체 청소량과 랭킹을 보여준다. 이 화면 하나로 (1) 제품의 세계관을 즉시 전달하고 (2) 핵심 기술(SSR 좌표 스냅샷 + 클라 보간 + Canvas 렌더)을 검증한다.

## 레이아웃 (모바일 세로)

```
┌───────────────────────────┐
│  ▚ JOOPS   [🌐 언어]      │  상단 바: 로고 + 언어 선택
├───────────────────────────┤
│                           │
│     ◯ 지구본 + 궤도       │  Canvas: 지구 + 경위도 그리드
│    · · 줍스 100개 · ·     │        + 움직이는 줍스 점들
│                           │
├───────────────────────────┤
│  누적 청소  ▓▓▓▓▓░ 62%    │  총 청소량 게이지 + 수치
│  1,284,000 조각 수거       │
├───────────────────────────┤
│  랭킹        주간 등락 ▁▂▃ │  랭킹 리스트 + 스파크라인
│  1. Orbita   ↑2  …        │
│  2. Dusty    ↓1  …        │
│  …                        │
│  (로그인 시) 나: 37위 ↑5   │  FR-1.8
├───────────────────────────┤
│   [ 초대코드로 시작하기 ]   │  미로그인 CTA → 온보딩(M2)
└───────────────────────────┘
```

## 데이터 흐름

```
서버(10초마다 재계산)                 클라이언트
────────────────────                 ──────────────
GET /api/orbital  ──── 스냅샷 ───▶   최초 SSR 렌더(서버 컴포넌트)
  export const revalidate = 10        │
  lib/orbit.ts 로 계산                 ├─ 10초 폴링으로 스냅샷 갱신
                                       └─ requestAnimationFrame:
                                          lib/orbit.ts 동일 공식으로
                                          t0→now 보간해 부드럽게 렌더
```

- **공유 계산 로직**: `lib/orbit.ts`(순수 함수)를 서버 route와 클라 Canvas 컴포넌트가 **동일하게 import**. 서버는 기준 스냅샷(기준시각 `t0`, 각 줍스 파라미터, 누적 집계)을 주고, 클라는 같은 공식으로 프레임마다 보간 → 서버 부하 최소화(FR-1.3/1.4, [ADR-0005](../../architecture/adr/0005-ssr-orbital-api.md)).
- **API 응답 형태(초안)**:
  ```jsonc
  {
    "serverTime": 1785067780000,   // ms epoch, 클라 시계 보정용
    "tickSeconds": 10,             // joop_03_game_config에서 (기본 10)
    "totals": { "debris": 1284000, "percent": 62.0 },
    "joops": [
      { "id": "...", "name": "Orbita", "color": "#39ff14",
        "orbit": { "radius": 1.15, "inclination": 51.6, "raan": 120, "phase0": 0.42, "angularVelocity": 0.00113 },
        "collected": 20400 }
      // … 100개
    ]
  }
  ```

## Canvas 2D 렌더링 스펙

- devicePixelRatio 대응(HiDPI 선명도), `requestAnimationFrame` 루프, 화면 미표시 시 정지.
- 지구: 중심 원 + 경위도 그리드(카세트퓨처리즘 그린/앰버 라인). 줍스: 색상 점(+옵션 잔상). 궤도: 얇은 링.
- 성능 목표: **줍스 100개 60fps**(중급 모바일). 좌표 계산은 프레임당 O(100)로 가볍게 유지.
- 접근성/폴백: Canvas 미지원 또는 `prefers-reduced-motion` 시 정지 스냅샷 + 수치 표시.

## i18n (FR-0.1)

- 이 화면의 모든 문자열은 dictionary 키로. 초안 키:
  `firstScreen.title`, `firstScreen.totalCollected`, `firstScreen.percentCleaned`,
  `firstScreen.ranking`, `firstScreen.weeklyChange`, `firstScreen.myRank`,
  `firstScreen.cta.startWithInvite`, `common.appName`.
- 영어 폴백 필수. 로케일 라우팅은 [ADR-0001](../../architecture/adr/0001-i18n.md).

## 필요한 데이터 (M1 한정)

[data-model](../../architecture/data-model.md)의 M1 필수 테이블만 사용:
- `joop_03_joops` — 100개 줍스(궤도 파라미터, 색, 이름, 누적 수거량)
- 랭킹/주간 등락 — `joop_03_debris_events` 집계 또는 `joop_03_rankings_weekly`
- 시드 데이터 필요(초기 100개 줍스 + 과거 수거 이벤트). RLS: 익명 **읽기 허용**, 쓰기는 서버(service_role)만.

## 인증 (FR-1.1 / FR-1.8)

- 이 화면 자체는 **공개**(미로그인 접근). 로그인 세션이 있으면 "내 랭킹" 블록 추가 표시.
- 로그인/초대 흐름은 M2. 여기서는 CTA 버튼만 온보딩으로 연결.

## 완료 기준 (DoD)

- [ ] `/[lang]` 첫 화면에서 100개 줍스가 궤도를 돌며 10초마다 서버 스냅샷과 정합
- [ ] 총 청소량/% 게이지, 랭킹, 주간 등락 스파크라인 표시
- [ ] 모바일 세로 60fps, reduced-motion 폴백
- [ ] 영어 포함 최소 2개 로케일 동작(나머지 8개는 키만 준비 가능)
- [ ] 로그인 시 내 랭킹 노출(더미 세션으로 검증 가능)

## 범위 밖 (M1 아님)

- 실제 초대/분양/설정(M2), 미니게임(M3), 아케이드(M5). CTA는 자리만.
