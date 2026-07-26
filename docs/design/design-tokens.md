# 디자인 토큰 v1.0 — 카세트퓨처리즘 (확정)

> 디자이너와 개발이 공유하는 **공용 어휘**의 확정본입니다(2026-07-26, M1 기준).
> 코드 반영 방법(Tailwind v4 `@theme` 복붙 스니펫 포함)은 **[M1 개발 핸드오프 가이드](./handoff-m1.md)** 를 보세요.
> 무드: "낡았지만 미래적인 우주 관제 콘솔" — 형광 그린 인광(P1 phosphor) + 앰버 CRT, 두꺼운 베젤, 절제된 네온.

## 1. 컬러 (다크 기본)

### 1-1. 코어 팔레트

| 토큰 | 값 | 역할 |
|---|---|---|
| `--color-bg` | `#05080a` | 기본 배경. 딥스페이스 블랙(네이비 기미). PWA `background_color`/`theme_color`와 동일값 |
| `--color-surface` | `#0d1412` | 패널·베젤 표면(그린 기미 차콜) = neutral-900 |
| `--color-surface-raised` | `#141c19` | 떠 있는 패널·버튼 표면 = neutral-800 |
| `--color-fg` | `#d8e6d4` | 기본 텍스트(인광 틴트 오프화이트) = neutral-100 |
| `--color-primary` | `#39ff14` | 형광 그린. 계기·주요 수치·CTA 강조. ※ 궤도 API 초안의 줍스 기본색과 동일 |
| `--color-primary-dim` | `#1d7a10` | 저휘도 인광(꺼진 세그먼트, 비활성 계기) |
| `--color-secondary` | `#ffb000` | 앰버 CRT. 보조 계기·주의 환기 |
| `--color-secondary-dim` | `#7a5500` | 저휘도 앰버 |
| `--color-accent` | `#2de2e6` | 시안 네온. 포인트(링크·선택 상태) 소량 |
| `--color-accent-magenta` | `#ff2e97` | 마젠타 네온. 극소량(이벤트·희귀 강조) |
| `--color-danger` | `#ff4545` | 경고·게임오버·랭킹 하락 |
| `--color-success` | `#00e08f` | 성공·랭킹 상승(primary와 구분되는 그린-시안) |
| `--color-muted` | `#7d8f7f` | 보조 텍스트·비활성 = neutral-400 |
| `--color-grid` | `rgba(57, 255, 20, 0.22)` | 지구본 경위도 그리드·궤도 링 기본 |
| `--color-grid-strong` | `rgba(57, 255, 20, 0.40)` | 그리드 강조선(적도·본초자오선) |
| `--color-grid-amber` | `rgba(255, 176, 0, 0.25)` | 앰버 그리드 변형(보조 링·눈금) |

### 1-2. 뉴트럴 스케일 (그린 틴트)

| 토큰 | 값 | | 토큰 | 값 |
|---|---|---|---|---|
| `--color-neutral-050` | `#f2f7f0` | | `--color-neutral-500` | `#5c6b5e` |
| `--color-neutral-100` | `#d8e6d4` | | `--color-neutral-600` | `#414d43` |
| `--color-neutral-200` | `#aebfab` | | `--color-neutral-700` | `#2a332c` |
| `--color-neutral-300` | `#8ba08c` | | `--color-neutral-800` | `#141c19` |
| `--color-neutral-400` | `#7d8f7f` | | `--color-neutral-900` | `#0d1412` |

`--color-bg`(#05080a)는 스케일 아래의 "우주 배경"으로 별도 관리합니다(패널이 배경보다 항상 밝게 떠 보이도록).

### 1-3. CRT 글로우 (box-shadow / text-shadow 값)

| 토큰 | 값 |
|---|---|
| `--glow-primary` | `0 0 6px rgba(57, 255, 20, 0.55), 0 0 18px rgba(57, 255, 20, 0.25)` |
| `--glow-secondary` | `0 0 6px rgba(255, 176, 0, 0.55), 0 0 18px rgba(255, 176, 0, 0.22)` |
| `--glow-accent` | `0 0 6px rgba(45, 226, 230, 0.55), 0 0 16px rgba(45, 226, 230, 0.22)` |
| `--glow-danger` | `0 0 6px rgba(255, 69, 69, 0.50)` |
| `--glow-text` | `0 0 4px rgba(57, 255, 20, 0.45)` (형광 텍스트용 text-shadow) |

**사용 규칙**: 글로우는 "형광 요소"에만(수치·게이지 채움·CTA·마커). 본문 텍스트·패널 전체에 걸지 않습니다(가독성·성능).

### 1-4. 대비 검증 (WCAG, `--color-bg` 기준)

| 전경 | 대비 | 판정 |
|---|---|---|
| `--color-fg` | 15.5 : 1 | AAA |
| `--color-primary` | 14.8 : 1 | AAA (수치 표시 OK) |
| `--color-secondary` | 11.0 : 1 | AAA |
| `--color-success` | 11.5 : 1 | AAA |
| `--color-danger` | 5.9 : 1 | AA (18px 미만 본문에도 OK) |
| `--color-muted` | 5.8 : 1 | AA (surface 위에서도 5.4:1) |

**주의**: 형광색을 **배경으로** 쓰면(예: CTA 채움) 그 위 텍스트는 `#05080a`(거의 검정)로 — `#39ff14` 위 검정 텍스트는 14.8:1로 안전. 형광 위에 흰 텍스트 금지.

## 2. 타이포그래피

### 2-1. 폰트 스택

| 토큰 | 스택 | 용도·제약 |
|---|---|---|
| `--font-display` | `"DSEG7 Classic", "Doto", "VT323", monospace` | **숫자·라틴 대문자 전용**(세그먼트/도트 계기). 한글·키릴 미지원 → 라벨 텍스트에 쓰지 않기 |
| `--font-body` | `system-ui, "Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans", sans-serif` | 본문·라벨. 10개 언어(라틴/CJK/키릴) 커버는 시스템 폰트에 위임 |
| `--font-mono` | `ui-monospace, "SFMono-Regular", "Cascadia Mono", "Noto Sans Mono", monospace` | 좌표·코드·표 숫자 정렬 |

- **DSEG7 Classic**(SIL OFL, [keshikan/DSEG](https://github.com/keshikan/DSEG))은 진짜 세븐세그먼트 폰트. 렌더 대상이 `0-9 . , % : -` 뿐이라 woff2 서브셋 ≈ 10–20KB → 셀프호스트 권장(선택). 미도입 시 **Doto**(Google Fonts, 도트매트릭스 가변 폰트)가 1차 폴백.
- **한국어 픽셀 폰트**(Galmuri·Neo둥근모)는 풀 한글 시 0.5–1MB → **M1 범위 밖, 후속 옵션**. 도입 시 KS X 1001 2,350자 서브셋 필수.
- display 폰트로 렌더할 수 없는 문자열(이름·라벨)은 반드시 `--font-body`/`--font-mono`로.

### 2-2. 타입 스케일 (px / line-height)

| 토큰 | 크기 | 굵기 | 용도 (첫 화면 기준) |
|---|---|---|---|
| `--text-display-lg` | 40 / 44 | 700 | 청소율 `62%` 대형 계기 |
| `--text-display-md` | 28 / 32 | 700 | 수거량 `1,284,000` |
| `--text-display-sm` | 20 / 24 | 700 | 랭킹 순위 숫자, 소형 계기 |
| `--text-title` | 17 / 24 | 600 | 섹션 제목(랭킹, 누적 청소) |
| `--text-body` | 15 / 22 | 400 | 본문·리스트·버튼 라벨 |
| `--text-caption` | 12 / 16 | 400 | 캡션·단위·보조 정보 |
| `--text-mono` | 13 / 20 | 400 | 좌표·정렬 숫자 |

- display 계열 letter-spacing `0.02em`(세그먼트 느낌), 본문 `0`.
- 최소 본문 크기 15px(모바일), caption 12px 미만 금지.

## 3. 간격 · 그리드 · 반경

### 3-1. 간격 (8pt 기반)

| 토큰 | 값 | | 토큰 | 값 |
|---|---|---|---|---|
| `--space-1` | 4px | | `--space-5` | 24px |
| `--space-2` | 8px | | `--space-6` | 32px |
| `--space-3` | 12px | | `--space-7` | 48px |
| `--space-4` | 16px | | `--space-8` | 64px |

### 3-2. 레이아웃·safe area

| 토큰 | 값 | 비고 |
|---|---|---|
| `--page-pad-x` | 20px | 좌우 기본 여백(360폭에서는 16px로 축소 허용) |
| `--content-max` | 480px | 세로 모바일 콘텐츠 최대 폭(그 이상은 중앙 정렬) |
| `--safe-top` | `max(env(safe-area-inset-top), 12px)` | 상단 노치/상태바 |
| `--safe-bottom` | `max(env(safe-area-inset-bottom), 12px)` | 홈 인디케이터 |
| 최소 터치 타깃 | 44 × 44px | 모든 인터랙티브 요소 |

### 3-3. 반경 · 베젤

| 토큰 | 값 | 용도 |
|---|---|---|
| `--radius-xs` | 2px | 게이지 세그먼트·태그 |
| `--radius-sm` | 4px | 버튼·입력 |
| `--radius-md` | 8px | 패널·카드 |
| `--radius-full` | 9999px | 마커·인디케이터 점 |
| `--bezel-border` | 2px | 패널·버튼 테두리 두께 |
| `--bezel-highlight` | `rgba(255, 255, 255, 0.06)` | 베젤 상단 인셋 하이라이트 |
| `--bezel-shadow` | `rgba(0, 0, 0, 0.6)` | 베젤 하단 인셋 섀도 |

카세트퓨처리즘은 각진 편: 큰 라운드 금지, 패널 최대 `--radius-md`.

## 4. 컴포넌트 스타일 (요약)

> 상태별 정확한 값·마크업 예시는 [핸드오프 가이드 §5](./handoff-m1.md)에.

| 컴포넌트 | 확정 방향 |
|---|---|
| 물리 버튼(CTA) | surface-raised 바탕 + 2px 베젤 + 인셋 하이라이트/섀도. 주요 CTA는 primary 채움 + `#05080a` 텍스트 + `--glow-primary`. 눌림: translateY(1px) + 섀도 축소 |
| 토글 | 아날로그 토글 스위치 은유(트랙 베젤 + 원형 노브, on = primary 발광) |
| 게이지 | **세그먼트 바**: 4px 세그먼트 + 2px 간격, 채움 primary + 글로우, 빈 칸 primary-dim @ 35% |
| 패널 | surface + 2px neutral-700 베젤 + 인셋 하이라이트, 좌상단 caption 라벨(선택: 코너 나사 도트) |
| 스캔라인 | 수평 반복 그라디언트, **불투명도 ≤ 0.06**, 3px 주기. Canvas 위엔 미적용(성능) |
| 랭킹 리스트 | 순위 = display-sm, 이름 = body, 수치 = mono 우측 정렬, 등락 = success/danger 화살표 |
| 스파크라인 | 1.5px primary 라인 + 아래 8% 그라디언트 채움, 점 없음 |

## 5. 모션

| 토큰 | 값 |
|---|---|
| `--motion-fast` | 120ms (눌림·토글) |
| `--motion-base` | 200ms (패널 전환·페이드) |
| `--motion-slow` | 400ms (게이지 채움·카운트업) |
| `--ease-console` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

- CRT 플리커·부팅 시퀀스는 **1회성 연출에만**(반복 금지). 스캔라인은 정적(움직이지 않음)이 기본.
- **`prefers-reduced-motion: reduce` 시**: 지속 애니메이션(궤도 줍스·카운트업·글로우 펄스) 정지, 정지 스냅샷 + 수치 표시로 대체. 전환은 페이드 없이 즉시.
- 게임 영역(Canvas rAF)과 UI 모션(CSS transition)은 분리 — Canvas는 화면 미표시 시 루프 정지.

## 6. 기술 매핑 메모(개발용)

- 반영 위치: `app/globals.css`의 `:root` 변수 + `@theme inline` (Tailwind v4, 설정 파일 없음). **복붙 스니펫: [핸드오프 가이드 §2](./handoff-m1.md)**.
- 다크가 기본값(`:root`에 다크 값). 라이트는 후순위 — 도입 시 `prefers-color-scheme: light` + `data-theme`으로 오버라이드.
- Canvas 2D 렌더러는 동일 토큰을 `getComputedStyle`로 읽거나 상수 모듈로 공유(중복 하드코딩 금지) → [ADR-0003](../architecture/adr/0003-rendering-canvas2d.md), 수치 명세는 [핸드오프 가이드 §4](./handoff-m1.md).
- PWA `theme_color`/`background_color` = `--color-bg`(#05080a) 단일 출처 → [ADR-0002](../architecture/adr/0002-pwa-portrait.md).
