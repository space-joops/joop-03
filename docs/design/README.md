# 디자인 문서 · 에셋 관리 가이드

이 폴더는 **디자이너에게 작업을 발주하고, 결과물을 repo로 받는** 데 필요한 문서를 모읍니다.

## 문서

- [design-brief.md](./design-brief.md) — **디자인 요청 브리프**. 무엇을, 왜, 어떤 제약으로 만들지. 디자이너가 가장 먼저 읽는 문서.
- [design-tokens.md](./design-tokens.md) — **디자인 토큰 초안**(카세트퓨처리즘). 색·타이포·간격·컴포넌트·모션의 공용 어휘.
- [asset-inventory.md](./asset-inventory.md) — **에셋 인벤토리**. 필요한 모든 에셋을 우선순위·포맷·사이즈·경로로 정리한 목록.

## 에셋을 repo로 관리하는 규칙

이 프로젝트는 디자인 파일/에셋을 **repo에 직접 커밋**합니다(외부 도구 링크가 아니라). 규칙을 지켜야 개발이 그대로 가져다 쓸 수 있습니다.

### 폴더 구조

원본(편집용)과 산출물(런타임 사용)을 분리합니다.

```
public/design-src/            # 원본·편집 소스(내보내기 전). 런타임에 직접 안 씀.
├── brand/                    #   로고, 워드마크, 심볼 원본
├── ui/                       #   화면별 UI 요소 원본
├── game/                     #   게임 스프라이트·배경 천체 원본
└── icons/                    #   PWA/파비콘 원본

public/                       # 런타임에서 참조하는 산출물(최적화 완료)
├── icon-192.png  icon-512.png  icon-maskable-512.png
├── apple-icon.png            #   180x180
├── brand/…  ui/…  game/…     #   내보낸 SVG/PNG/WebP
app/icon.png  app/apple-icon.png  app/favicon.ico   # Next.js 파일 기반 아이콘 API
```

> 참고: `app/icon.png` · `app/apple-icon.png` · `app/favicon.ico` 는 커스텀 Next.js의 **파일 기반 아이콘 API**로, 놓으면 자동으로 `<link>`가 생성됩니다. PWA 매니페스트 아이콘(192/512/maskable)은 `public/`에 두고 `app/manifest.ts`가 참조합니다. → [ADR-0002](../architecture/adr/0002-pwa-portrait.md)
>
> PNG 4종 + `app/favicon.ico`(16+32 PNG-in-ICO)는 전부 `npm run gen:icons`
> (`scripts/generate-icons.mjs`)로 `public/design-src/icons/` 마스터 SVG에서 파생합니다 —
> 마스터를 고친 뒤 재실행하고, 산출물을 손으로 편집하지 마세요. `public/icon.svg`는
> `icon-master.svg`의 복사본이라 마스터 수정 시 함께 갱신합니다.
>
> iOS 스타트업 이미지(`public/brand/splash-*.png` 5종)는 `npm run gen:splash`
> (`scripts/generate-splash.mjs`)로 파생합니다. iOS는 **기기 해상도가 정확히 일치할 때만**
> 스플래시를 쓰므로, 한 장을 리사이즈하지 않고 사이즈마다 SVG를 새로 조립해 렌더합니다
> (배치는 화면 비율 기준: 엠블럼 폭 72%·세로 42%, 워드마크 폭 50%·세로 62%).
> 기하의 출처는 마스터 `public/design-src/brand/splash-template.svg`이고,
> 인앱 스플래시 `components/splash-mark.tsx`도 같은 기하를 씁니다 —
> **셋 중 하나를 고치면 나머지도 함께 고치세요.**
>
> 아케이드 배경 천체 WebP(`public/game/bg-*.webp`)는 `npm run gen:game`
> (`scripts/generate-game-bg.mjs`)로 `public/design-src/game/bg-*-master.svg`에서
> 파생합니다. 마스터가 feTurbulence 필터를 쓰므로 **Chromium(Playwright)으로
> 렌더**합니다 — librsvg(sharp)로 직접 래스터하면 결과가 다릅니다. 지구 대륙층
> `bg-earth-land.png`와 은하 별밭(@stars 구간)은 스크립트가 결정적으로 생성합니다.

### 네이밍

- **kebab-case**: `joop-marker-green.svg`, `debris-can-01.png`
- 사이즈/배율 접미사: `-192`, `-512`, `@2x` (예: `icon-192.png`, `splash@2x.png`)
- 상태/변형: `-active`, `-disabled`, 색 변형은 색 이름(`-green`, `-amber`)

### 포맷

| 용도 | 포맷 | 비고 |
|---|---|---|
| UI 아이콘·로고·벡터 | **SVG** | 색은 가능하면 `currentColor`로 토큰 연동 |
| 게임 스프라이트 | **PNG**(투명) 또는 **WebP** | 다중 프레임은 **스프라이트시트** + 좌표 메타(JSON) |
| 배경 천체·사진 | **WebP**(우선) / PNG | 대용량 주의, 아래 최적화 기준 |
| PWA/파비콘 | **PNG** | 192·512·maskable-512·apple-touch 180 |

### 최적화 기준

- 단일 UI PNG/WebP는 되도록 **≤ 200KB**, 전체 화면 배경도 **≤ 500KB** 목표(모바일).
- `next/image` 주의(커스텀 Next.js): `priority`는 **deprecated → `preload`/`fetchPriority="high"`**, `minimumCacheTTL` 기본이 60s→4h로 바뀜. 스프라이트를 쿼리스트링으로 캐시버스트하면 `images.localPatterns.search` 설정 필요. → [ADR-0003](../architecture/adr/0003-rendering-canvas2d.md)
- Canvas 2D로 그리는 스프라이트는 **좌표 기준점(anchor)** 과 여백 규칙을 산출물에 맞춰 고정(인벤토리 참조).

### 반영 절차

디자이너/담당자는 에셋을 위 규칙대로 배치하고 **PR로 반영**합니다(팀 PR 워크플로우, 한국어). 큰 바이너리가 늘면 이후 Git LFS 도입을 검토합니다(현재는 미도입).
