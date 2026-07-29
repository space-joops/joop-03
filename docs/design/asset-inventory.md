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
| 스플래시(스타트업) | M1 | PNG | 기기별 5종 | ✅ `public/brand/splash-*.png` (`gen:splash`로 파생, `app/[lang]/layout.tsx` startupImage 연결). 마스터 `public/design-src/brand/splash-template.svg` · 인앱 스플래시 `components/splash-mark.tsx`와 기하 공유 |

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
| 배경 천체 — 지구 | 후속 | SVG 마스터 → WebP | ✅ | ✅ **실사풍 적용** (2026-07-28): `public/game/bg-earth.webp` (2048²) — world-atlas 실지형 대륙(`bg-earth-land.png`, 스크립트 산출) + feTurbulence 구름 + 대기 림 + 터미네이터. 마스터 `public/design-src/game/bg-earth-master.svg`, 재생성 `npm run gen:game`. 구 시안 `celestial-earth.svg` 는 미사용 보관 |
| 배경 천체 — 달 | 후속 | SVG 마스터 → WebP | ✅ | ✅ **실사풍 적용**: `public/game/bg-moon.webp` (1536²) — 레골리스 노이즈 + 마리아 + 저대비 크레이터. 마스터 `bg-moon-master.svg`, `gen:game`. 구 시안 `celestial-moon.svg` 미사용 보관 |
| 배경 천체 — 태양 | 후속 | SVG 마스터 → WebP | ✅ | ✅ **실사풍 적용**: `public/game/bg-sun.webp` (1792²) — 순백 코어 + 과다노출 글로우(만화 광선 제거). 마스터 `bg-sun-master.svg`, `gen:game`. 구 시안 `celestial-sun.svg` 미사용 보관 |
| 배경 — 은하수/은하 | 후속 | SVG 마스터 → WebP | ✅ | ✅ **실사풍 적용**: `public/game/bg-galaxy.webp` — **가로 심리스 타일**(3072×1536, stitchTiles) 밴드 + 더스트 레인 + 시드 별밭(gen:game 이 주입). 마스터 `bg-galaxy-master.svg`. 구 시안 `celestial-milkyway.svg` 미사용 보관 |
| 위성 스프라이트 | 후속 | SVG(시안) → PNG/WebP(+시트) | ✅ | ✅ **제작됨**: `public/game/satellite-{comm,probe}.svg` — 근경/원경 2종(원근 스케일용) |
| 5원 반투명 조이스틱 | 후속 | SVG | ✅ | ✅ **제작됨**: `public/game/joystick.svg` — 원 5개·반투명·분사량(라디얼 게이지) 상태 |
| 분사가스/이펙트 | 후속 | PNG(+시트) | ✅ | ⏳ 미제작 — 정지 표현은 조이스틱/캐릭터에 포함. 파티클 프레임 시트는 후속 |
| 인벤토리·아이템 아이콘 | 후속 | SVG | | ✅ **제작됨**: `public/game/item-{magnet,health,fuel}.svg` — 자석·체력·연료 |
| 발사체(로켓) | 후속 | SVG 마스터 → SVG | ✅ | ✅ **실사화 적용** (2026-07-29): `public/game/rocket.svg` — Falcon 9 실루엣 64×**256**(기존 64×160), ogive 페어링 + 인터스테이지 검정 밴드 + 그리드핀 4장 + 수납 착륙다리 + 그을음 + 옥타웹/노즐벨 3. 마스터 `rocket-master.svg`, `npm run gen:game` 이 **그대로 복사**(SVG 패스스루). 코드 앵커: 노즐 [32,250], `NOSE_FRAC`=62/256, `STAGE1_FRAC`=130/256 — 페어링·단 분리를 크롭으로 표현 |
| 큐브샛(사출체) | 후속 | SVG 마스터 → SVG | ✅ | ✅ **신규** (2026-07-29): `public/game/cubesat.svg` — 3U 큐브샛(금박 MLI + 접힌 태양판 + 휩 안테나 + 스타트래커). viewBox 128 기준 **해치 x48 y28 w32 h8** 위에 코드가 힌지 뚜껑을 그린다(줍스 방출구). 마스터 `cubesat-master.svg`, `gen:game` SVG 패스스루 |
| 광고 위성 6종 | 후속 | SVG 마스터 → SVG | ✅ | ✅ **신규** (2026-07-29, v0.17.0): `public/game/ad-sat-{vrerv,diginori,spacex,obital-radar,uzuro-tech,spacemap}.svg` — 아케이드 플라이바이(FR-7.7)용 1024×512 앵커 중심. 브랜드별 실루엣 차별화(VR 바이저/큐브 스택/플랫 패널+세로 태양전지/파라볼라/육각+3붐/구체+궤도 링) + 하단 광고판 패널(워드마크는 코드가 캔버스 fillText 로 그림 — SVG 텍스트 금지 규약). 마스터 `ad-sat-*-master.svg`, `gen:game` SVG 패스스루. 데이터는 `lib/ad-satellites.ts` 하드코딩(광고 관리자 DB 연동 TODO) |

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
