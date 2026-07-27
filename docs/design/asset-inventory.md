# 에셋 인벤토리

> 필요한 모든 디자인 에셋 목록입니다. 우선순위(**M1**=첫 화면 착수용 / **후속**), 포맷, 사이즈/변형, repo 경로를 정리합니다.
> 배치·네이밍·포맷 규칙은 [에셋 관리 규칙](./README.md)을 따릅니다. UI 요소 근거는 [첫 화면 스펙](../product/screens/01-first-screen.md).

## 범례

- **포맷**: SVG(벡터/아이콘) · PNG/WebP(비트맵) · PNG(아이콘 세트)
- **Canvas**: ✅ = Canvas 2D로 그려지는 요소(좌표 기준점·수치 명세 필요)

---

## A. 브랜드 · PWA (1순위)

| 에셋 | 우선 | 포맷 | 사이즈/변형 | repo 경로(산출물) |
|---|---|---|---|---|
| 로고(워드마크 가로) | M1 | SVG | 단색/형광 2종 | `public/brand/logo-wordmark.svg` |
| 심볼(줍스 마크) | M1 | SVG | 정사각 | `public/brand/logo-symbol.svg` |
| 파비콘 | M1 | ICO/PNG | 32, 16 | `app/favicon.ico` (`gen:icons`로 파생) |
| 앱 아이콘 | M1 | PNG | **192**, **512** | `public/icon-192.png`, `public/icon-512.png` |
| 앱 아이콘(maskable) | M1 | PNG | **512**(안전영역 준수) | `public/icon-maskable-512.png` |
| apple-touch 아이콘 | M1 | PNG | **180** | `app/apple-icon.png` |
| 스플래시(스타트업) | M1 | PNG | 기기별 5종 | ✅ `public/brand/splash-*.png` (PR #19 반입, `app/[lang]/layout.tsx` startupImage 연결) |

## B. 첫 화면(M1) UI

| 에셋 | 우선 | 포맷 | Canvas | 비고 / repo 경로 |
|---|---|---|---|---|
| 상단 바 배경/베젤 | M1 | SVG/CSS | | 토큰으로 구현 가능하면 에셋 불필요 |
| 언어 선택 아이콘(🌐) | M1 | SVG | | `public/ui/icon-language.svg` |
| 지구본 + 경위도 그리드 | M1 | 수치 명세 | ✅ | 색·선두께·반경 비율 명세(스프라이트 아님) |
| 궤도 링 | M1 | 수치 명세 | ✅ | 링 두께·투명도 |
| 줍스 마커(점) | M1 | SVG/PNG | ✅ | **색 변형** 다수(줍스 색). 작은 발광 점 + anchor 중심 |
| 청소량 게이지 | M1 | SVG/CSS | | 세그먼트 계기 스타일, 값 가변 |
| 랭킹 리스트 아이템 | M1 | CSS | | 등락 화살표 아이콘 필요 |
| 등락 화살표(▲▼) | M1 | SVG | | `public/ui/arrow-up.svg`, `arrow-down.svg`(success/danger 색) |
| 주간 등락 스파크라인 | M1 | 수치 명세 | ✅ | 형광 라인, 데이터 가변 |
| "초대코드로 시작" CTA | M1 | SVG/CSS | | 물리 버튼 스타일(형광 강조) |
| 로딩/스켈레톤·빈 상태 | M1 | CSS | | reduced-motion 대안 |

> 지구본·궤도·줍스 마커·스파크라인은 코드가 Canvas로 그리므로, "이미지 파일"보다 **색·비율·선 두께 명세**가 핵심입니다. 줍스 마커만 색 변형 스프라이트로 뽑아둘 수 있습니다.

## C. 게임 에셋 (후속)

> **1차 SVG 시안 제작됨** (2026-07-27). 아케이드(M5) 착수 전 벡터 시안으로, 원본은 `public/design-src/game/`, 산출물은 `public/game/` 에 동일 SVG로 배치. 최종 Canvas 렌더 단계에서 PNG/WebP+시트로 재출력 예정.

| 에셋 | 우선 | 포맷 | Canvas | 상태 / 경로 |
|---|---|---|---|---|
| 줍스 캐릭터 | 후속 | PNG 시트 | ✅ | ✅ **시트 적용됨** (PR #19 반입): `public/game/joop-sheet-{green,amber,cyan,magenta,lime,gold}.png` + `joop-sheet.meta.json` — 6색 × idle/move/collect 각 2프레임(128px). 지상 미니게임·브리핑·대시보드에서 사용(`lib/joop-sprite.ts`). 구 SVG 시안 `joop-{green,amber,cyan}.svg` 는 미사용 보관 |
| 우주 쓰레기 스프라이트 세트 | 후속 | PNG 시트 | ✅ | ✅ **시트 적용됨** (PR #19 반입): `public/game/debris-sheet.png` + meta — 6종(캔·볼트·너트·패널·구조재·회로). 미니게임에서 사용. 구 SVG `debris-*.svg` 는 미사용 보관 |
| 배경 천체 — 지구 | 후속 | SVG(시안) → WebP | ✅ | ✅ **제작됨**: `public/game/celestial-earth.svg` — 경위도 그리드 + 형광 대륙 + 터미네이터 |
| 배경 천체 — 달 | 후속 | SVG(시안) → WebP | ✅ | ✅ **제작됨**: `public/game/celestial-moon.svg` — 크레이터/마리아 |
| 배경 천체 — 태양 | 후속 | SVG(시안) → WebP/PNG | ✅ | ✅ **제작됨**: `public/game/celestial-sun.svg` — 앰버 광구 + 형광 코로나 발광 |
| 배경 — 은하수/은하 | 후속 | SVG(시안) → WebP | ✅ | ✅ **제작됨**: `public/game/celestial-milkyway.svg` — **가로 심리스 타일** 밴드(512×200) |
| 위성 스프라이트 | 후속 | SVG(시안) → PNG/WebP(+시트) | ✅ | ✅ **제작됨**: `public/game/satellite-{comm,probe}.svg` — 근경/원경 2종(원근 스케일용) |
| 5원 반투명 조이스틱 | 후속 | SVG | ✅ | ✅ **제작됨**: `public/game/joystick.svg` — 원 5개·반투명·분사량(라디얼 게이지) 상태 |
| 분사가스/이펙트 | 후속 | PNG(+시트) | ✅ | ⏳ 미제작 — 정지 표현은 조이스틱/캐릭터에 포함. 파티클 프레임 시트는 후속 |
| 인벤토리·아이템 아이콘 | 후속 | SVG | | ✅ **제작됨**: `public/game/item-{magnet,health,fuel}.svg` — 자석·체력·연료 |

## D. 공통 UI (전 화면, 후속 포함)

| 에셋 | 우선 | 포맷 | 비고 |
|---|---|---|---|
| 아이콘 세트(설정·뒤로·닫기·공유·알림 등) | M1~후속 | SVG | 일관된 라인/그리드 |
| 토스트·모달·다이얼로그 스타일 | 후속 | CSS/SVG | 베젤 패널 |
| 탭바/내비게이션 | 후속 | SVG/CSS | 화면 확장 시 |

---

## 커버리지 확인

첫 화면(M1) 스펙의 UI 요소 ↔ 위 목록 대응(누락 방지):

- 로고 → A / 언어 선택 → B / 지구본·궤도·줍스 → B(Canvas) / 청소량 게이지·수치 → B / 랭킹·등락 화살표 → B / 주간 등락 스파크라인 → B / 내 랭킹 → B(리스트 재사용) / 초대 CTA → B. ✅ 첫 화면 요소 전부 매핑됨.
