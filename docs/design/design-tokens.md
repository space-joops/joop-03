# 디자인 토큰 — 카세트퓨처리즘 (확정)

> 디자이너와 개발이 공유하는 **공용 어휘**입니다. 아래 값은 **확정본**이며 `app/globals.css`
> 의 `:root` + `@theme inline`(Tailwind v4)에 그대로 반영되어 있습니다.
> M1 컴포넌트는 `var(--color-*)` 이름을 참조하므로 **변수 이름은 고정**이고 값만 확정합니다.
> 모든 텍스트/전경 조합은 WCAG **AA(≥4.5:1)** 대비를 통과하도록 선정했습니다(형광색 위 텍스트 주의).

## 1. 컬러 (확정)

**다크 기본.** 그린 틴트 블랙 위 형광 모노크롬 + 앰버 위계 (이슈 #5 CRT 컨셉).

> **투톤 위계 원칙 (이슈 #5)**: 섹션 제목·수치·진행바·포인트는 **앰버(`--color-secondary`)**,
> 본문·지구·이름·CTA는 **그린(`--color-primary`)/fg** 로 구분한다.

| 토큰 | 역할 | HEX | 비고 |
|---|---|---|---|
| `--color-bg` | 기본 배경 | `#030a05` | 딥스페이스(거의 검정, 그린 틴트 — CRT phosphor). 매니페스트 배경도 동일 |
| `--color-surface` | 패널·베젤 표면 / 지구 본체 | `#0a1c10` | 배경보다 밝은 다크 그린 |
| `--color-fg` | 기본 텍스트 | `#e4f2e9` | 형광 기미 오프화이트 (bg 대비 17.3:1) |
| `--color-muted` | 보조 텍스트·비활성 | `#8a9e92` | 데새추레이트 그린그레이 (bg 7.0:1 / surface 6.2:1) |
| `--color-primary` | 형광 강조·계기·CTA | `#35e07a` | P1 phosphor 그린. CTA 배경(위 텍스트는 `--color-bg`, 11.5:1) |
| `--color-secondary` | 섹션 제목·수치·진행바(앰버 위계) | `#ffb23e` | P3 앰버 phosphor (bg 11.1:1, 채움 위 텍스트는 `--color-bg`) |
| `--color-accent` | 절제된 네온 포인트 | `#38e0f0` | 시안. 소량 사용 |
| `--color-danger` | 경고·게임오버·하락 | `#ff5c77` | 레드(핑크 기미로 다크 위 가독성 확보) |
| `--color-success` | 상승·성공 | `#7ce64b` | 라임 — primary 그린과 **색상(hue)으로 구분** |
| `--color-grid` | 지구본/궤도 그리드 라인 | `#1e5a46` | 저채도 그린. 라인/비활성 세그먼트에 |

**뉴트럴 스케일** (패널·구분선·비활성): `--color-neutral-050 … -900`
`#eef4f0 · #cdd8d2 · #9fb0a7 · #71847b · #4c5c54 · #33413b · #232e29 · #17201c · #0d1a12 · #06110a`

**CRT 글로우** (형광 요소 외곽; `box-shadow`/`text-shadow` 로 사용):
`--glow-primary: 0 0 8px rgba(53,224,122,.55)` · `--glow-secondary` · `--glow-accent` · `--glow-danger`

> **대비 원칙**: 텍스트는 `--color-bg`/`--color-surface` 위 `--color-fg`/`--color-muted` 로.
> 형광색(primary/secondary/accent)은 **강조·라인·계기**에 쓰고, 그 **위에 텍스트를 올릴 때는
> 어두운 `--color-bg` 를 전경색**으로 사용한다(예: CTA 버튼).

## 2. 타이포그래피 (확정)

| 토큰 | 역할 | 값 |
|---|---|---|
| `--font-display` | 계기·수치·헤드라인 | Geist Mono 스택 (모노 = 세븐세그먼트 대체) |
| `--font-body` / `--font-sans` | 본문·라벨(다국어) | Geist Sans 스택 |
| `--font-mono` | 좌표·수치 | Geist Mono 스택 |

- 외부 폰트 파일 미도입(라이선스). display 는 로드된 **Geist Mono** 로 대체(숫자·라틴에 모노
  질감). 본문은 다국어 지원 **Geist Sans**(CJK/키릴은 시스템 폴백).
- `--font-sans`/`--font-mono` 는 `@theme inline` 에서 Tailwind `font-sans`/`font-mono` 유틸로 노출.

**스케일**(px / rem):

| 토큰 | 크기 | 용도 |
|---|---|---|
| `--text-display-lg` | 40px (2.5rem) | 대형 수치 |
| `--text-display-md` | 24px (1.5rem) | 청소량 등 계기 수치 |
| `--text-title` | 18px (1.125rem) | 로고/타이틀 |
| `--text-body` | 14px (0.875rem) | 본문·라벨 |
| `--text-caption` | 12px (0.75rem) | 캡션 |
| `--text-micro` | 10px (0.625rem) | 마이크로 라벨 |

`--leading-tight: 1.1` · `--leading-normal: 1.45` · `--tracking-wide: .1em` · `--tracking-widest: .2em`(계기판 라벨)

## 3. 간격 · 그리드 · 반경 (확정)

**8pt 기반 간격**: `--space-1:4 · -2:8 · -3:12 · -4:16 · -5:24 · -6:32 · -8:48` (px)
**콘텐츠 최대 폭**: `--content-max: 28rem`(448px) — 세로 모바일 1열, 좌우 여백. safe area 는
컴포넌트에서 `env(safe-area-inset-*)` 로 처리(상단 헤더 / 하단 CTA).

**반경**(각진 편 + 두꺼운 베젤 대비): `--radius-sm:2px · -md:4px · -lg:8px · -pill:999px`

## 4. 컴포넌트 스타일 방향

| 컴포넌트 | 방향 | 토큰 매핑 |
|---|---|---|
| CTA 버튼 | 형광 배경 + 다크 전경(물리 버튼) | bg `--color-primary`, text `--color-bg` |
| 게이지/미터 | 세그먼트 바(24칸), 채움=형광+글로우, 빈칸=surface | `--color-primary` + `--glow-primary` / `--color-surface` |
| 패널/카드·랭킹 아이템 | 두꺼운 베젤 표면 | bg `--color-surface`, text `--color-fg`/`--color-muted` |
| 등락 화살표 | 상승/하락 색 구분 | ▲ `--color-success` / ▼ `--color-danger` |
| 스파크라인 | 형광 라인 | stroke `--color-primary` |
| 지구본/궤도(Canvas) | 저채도 그리드 + surface 지구 | line `--color-grid`, fill `--color-surface` |
| 줍스 마커(Canvas) | 발광 점 | 데이터별 색 + `shadowBlur`(글로우) |

## 5. 모션

- CRT 플리커·스캔라인·부팅 시퀀스는 **절제** 사용.
- 모든 지속 애니메이션은 **`prefers-reduced-motion: reduce`** 시 정지/최소화(궤도 Canvas 는
  이미 reduced-motion 시 1회 정지 렌더).

## 6. 기술 매핑 (개발용)

- 확정 토큰 → `app/globals.css` `:root` 변수 + `@theme inline` 색/폰트 매핑 → Tailwind 유틸.
- Canvas 2D 렌더러는 `getComputedStyle` 로 동일 토큰(`--color-grid`, `--color-surface`)을 읽어
  하드코딩 중복을 피한다(→ [ADR-0003](../architecture/adr/0003-rendering-canvas2d.md)).
  **폴백 hex 는 항상 토큰과 동일 값으로 유지**한다(토큰 값 변경 시 폴백도 함께 갱신).
- `themeColor`(app/[lang]/layout.tsx · app/admin/layout.tsx)와 `app/manifest.ts` 의
  `background_color`/`theme_color` 는 `--color-bg` 와 동일 값으로 동기화한다.
- 라이트/다크는 `prefers-color-scheme` + `data-theme` 토글 대비. **현재 다크가 기본.**
