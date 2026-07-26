# 에셋 인벤토리

> 필요한 모든 디자인 에셋 목록입니다. 우선순위(**M1**=첫 화면 착수용 / **후속**), 포맷, 사이즈/변형, repo 경로를 정리합니다.
> 배치·네이밍·포맷 규칙은 [에셋 관리 규칙](./README.md)을 따릅니다. UI 요소 근거는 [첫 화면 스펙](../product/screens/01-first-screen.md).
> **납품 상태(2026-07-26)**: ✅ = repo 반영 완료. 상세 사용법은 [핸드오프 가이드 §7](./handoff-m1.md). 마스터 원본은 `public/design-src/`.

## 범례

- **포맷**: SVG(벡터/아이콘) · PNG/WebP(비트맵) · PNG(아이콘 세트)
- **Canvas**: ✅ = Canvas 2D로 그려지는 요소(좌표 기준점·수치 명세 필요)

---

## A. 브랜드 · PWA (1순위)

| 에셋 | 우선 | 포맷 | 사이즈/변형 | repo 경로(산출물) | 상태 |
|---|---|---|---|---|---|
| 로고(워드마크 가로) | M1 | SVG | 단색/형광 2종 → **2파일**: 단색(currentColor)은 `logo-wordmark.svg`, 형광+글로우는 `logo-wordmark-glow.svg` | `public/brand/logo-wordmark.svg` · `logo-wordmark-glow.svg` | ✅ |
| 심볼(줍스 마크) | M1 | SVG | 정사각(64), currentColor | `public/brand/logo-symbol.svg` | ✅ |
| 파비콘 | M1 | ICO/PNG | 32, 16 | `app/favicon.ico` | ✅ |
| 앱 아이콘 | M1 | PNG | **192**, **512** (+ `app/icon.png` 512) | `public/icon-192.png`, `public/icon-512.png` | ✅ |
| 앱 아이콘(maskable) | M1 | PNG | **512**(안전영역=중앙 원 r40% 준수) | `public/icon-maskable-512.png` | ✅ |
| apple-touch 아이콘 | M1 | PNG | **180** | `app/apple-icon.png` | ✅ |
| 스플래시(스타트업) | M1 | PNG | iOS 세로 5종: 1179×2556 · 1206×2622 · 1290×2796 · 1320×2868 · 1170×2532 (Android는 매니페스트로 자동) | `public/brand/splash-*.png` | ✅ |

## B. 첫 화면(M1) UI

| 에셋 | 우선 | 포맷 | Canvas | 비고 / repo 경로 | 상태 |
|---|---|---|---|---|---|
| 상단 바 배경/베젤 | M1 | SVG/CSS | | 토큰만으로 구현(에셋 불필요) → [핸드오프 §5-1](./handoff-m1.md) | ✅ |
| 언어 선택 아이콘(🌐) | M1 | SVG | | `public/ui/icon-language.svg` | ✅ |
| 지구본 + 경위도 그리드 | M1 | 수치 명세 | ✅ | [핸드오프 §4](./handoff-m1.md) + 시안 레퍼런스 구현 | ✅ |
| 궤도 링 | M1 | 수치 명세 | ✅ | [핸드오프 §4](./handoff-m1.md) | ✅ |
| 줍스 마커(점) | M1 | 수치 명세 | ✅ | 색은 API `joops[].color`(권장 6색 팔레트), r2.5 + 글로우, anchor 중심 → [핸드오프 §4](./handoff-m1.md) | ✅ |
| 청소량 게이지 | M1 | SVG/CSS | | 세그먼트 30칸 스펙 → [핸드오프 §5-3](./handoff-m1.md) | ✅ |
| 랭킹 리스트 아이템 | M1 | CSS | | [핸드오프 §5-4](./handoff-m1.md) | ✅ |
| 등락 화살표(▲▼) | M1 | SVG | | `public/ui/arrow-up.svg`, `arrow-down.svg`(success/danger 색) | ✅ |
| 주간 등락 스파크라인 | M1 | 수치 명세 | ✅ | 44×16 · 1.5px → [핸드오프 §5-4](./handoff-m1.md) | ✅ |
| "초대코드로 시작" CTA | M1 | SVG/CSS | | 물리 버튼 스펙 → [핸드오프 §5-5](./handoff-m1.md) | ✅ |
| 로딩/스켈레톤·빈 상태 | M1 | CSS | | [핸드오프 §5-7](./handoff-m1.md), reduced-motion 대안 포함 | ✅ |

> 지구본·궤도·줍스 마커·스파크라인은 코드가 Canvas로 그리므로, "이미지 파일"보다 **색·비율·선 두께 명세**가 핵심입니다. 줍스 마커만 색 변형 스프라이트로 뽑아둘 수 있습니다.

## C. 게임 에셋 (후속)

| 에셋 | 우선 | 포맷 | Canvas | 비고 | 상태 |
|---|---|---|---|---|---|
| 줍스 캐릭터 | 후속 | PNG/WebP(+시트) | ✅ | 색 변형 6종 × 상태 3(대기·이동·수거) × 2프레임. `public/game/joop-sheet-{색}.png`(768×128) + `joop-sheet.meta.json`(anchor·fps). 마스터 `public/design-src/game/`, 사용법 [핸드오프 M2 §2](./handoff-m2.md) | ✅ |
| 우주 쓰레기 스프라이트 세트 | 후속 | PNG/WebP(+시트) | ✅ | 6종(캔·볼트·너트·태양전지판·구조재·회로기판) 64×64. `public/game/debris-sheet.png` + `debris-sheet.meta.json`(값·사이즈 클래스·회전 규칙) → [핸드오프 M3 §2](./handoff-m3.md) | ✅ |
| 배경 천체 — 지구 | 후속 | WebP | ✅ | `public/game/bg-earth.webp`(1024², 64KB, 절차 생성 — NASA 사진 미사용) → [핸드오프 M5 §1](./handoff-m5.md) | ✅ |
| 배경 천체 — 달 | 후속 | WebP | ✅ | `public/game/bg-moon.webp`(1024², 16KB) | ✅ |
| 배경 천체 — 태양 | 후속 | WebP/PNG | ✅ | `public/game/bg-sun.webp`(1024², 96KB, 발광·코로나 포함) | ✅ |
| 배경 — 은하수/은하 | 후속 | WebP | ✅ | `public/game/bg-galaxy.webp`(2048×1024 **수평 타일**, 16KB) | ✅ |
| 위성 스프라이트 | 후속 | PNG/WebP(+시트) | ✅ | `public/game/satellite.png`(512×256), 원근은 코드 스케일 0.15~2.4 → [핸드오프 M5 §2](./handoff-m5.md) | ✅ |
| 5원 반투명 조이스틱 | 후속 | SVG/PNG | ✅ | 원 5개(링 4 + 노브), 반투명, 분사 단계 표시 — 파일 대신 **수치 명세**로 납품 → [핸드오프 M3 §3](./handoff-m3.md) | ✅(명세) |
| 분사가스/이펙트 | 후속 | PNG(+시트) | ✅ | 동적 파티클이라 파일 대신 **코드 명세**(원 감쇠 수열) → [핸드오프 M5 §3](./handoff-m5.md) | ✅(명세) |
| 인벤토리·아이템 아이콘 | 후속 | SVG | | 합성/업그레이드(자석·체력·꾸미기) | |
| 발사체(로켓) | 후속 | SVG | | 카운트다운·중계 화면용 64×160, anchor [32,152]. `public/game/rocket.svg`, 화염·연기는 이펙트 명세 → [핸드오프 M4 §2](./handoff-m4.md) | ✅ |

## D. 공통 UI (전 화면, 후속 포함)

| 에셋 | 우선 | 포맷 | 비고 | 상태 |
|---|---|---|---|---|
| 아이콘 세트(설정·뒤로·닫기·공유·알림 등) | M1~후속 | SVG | 24 그리드 통일. `public/ui/icon-settings.svg` · `icon-close.svg` · `icon-back.svg` · `icon-share.svg` 선반영 | ✅(4종) |
| 토스트·모달·다이얼로그 스타일 | 후속 | CSS/SVG | 베젤 패널 | |
| 탭바/내비게이션 | 후속 | SVG/CSS | 화면 확장 시 | |

---

## 커버리지 확인

첫 화면(M1) 스펙의 UI 요소 ↔ 위 목록 대응(누락 방지):

- 로고 → A / 언어 선택 → B / 지구본·궤도·줍스 → B(Canvas) / 청소량 게이지·수치 → B / 랭킹·등락 화살표 → B / 주간 등락 스파크라인 → B / 내 랭킹 → B(리스트 재사용) / 초대 CTA → B. ✅ 첫 화면 요소 전부 매핑됨.
