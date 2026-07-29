# 02. HTML·CSS 첫걸음 — 웹의 문서 모델

> 파이썬 개발자에게 웹 화면은 "터미널 출력의 화려한 버전"처럼 보이지만, 실제로는 **트리 자료구조를 선언적으로 스타일링하는 시스템**입니다. 이 문서는 그 모델을 우리 코드의 실제 화면으로 설명합니다.

## 1. DOM = 중첩 dict 를 브라우저가 그린 것

파이썬으로 비유하면 HTML 은 이런 자료구조의 직렬화입니다:

```python
# 파이썬 감각으로 본 HTML
{"tag": "ul", "children": [
    {"tag": "li", "children": [
        {"tag": "span", "text": "1."},
        {"tag": "span", "text": "코스모"},
    ]},
]}
```

브라우저는 이 트리(DOM, Document Object Model)를 파싱해 메모리에 들고, CSS 로 모양을 입히고, JS 로 조작을 허용합니다. **"화면을 그린다" = "트리를 편집한다"** 가 웹의 기본 멘탈모델입니다. (React 는 이 트리 편집을 자동화해 주는 도구입니다 — 04 문서.)

### 시맨틱 태그 — 태그 이름에는 의미가 있다

`div` 로 다 만들 수 있지만, 의미 있는 태그를 쓰면 접근성(스크린리더)·SEO·코드 가독성이 좋아집니다. 우리 코드의 실제 선택:

- **랭킹은 `<ol>`/`<li>`** (`components/ranking-list.tsx`) — "순서 있는 목록"이라는 의미 그 자체.
- **관리자만 `<table>`** (`components/admin/*`) — 진짜 표 형태 데이터(열 정렬·비교)가 필요한 곳. 게임 화면은 모바일 세로에서 표가 부적합해 목록으로 갑니다. 이 구분의 이유가 admin 코드 주석에 남아 있습니다.
- **버튼은 `<button>`, 이동은 `<a>`(Next 의 `<Link>`)** — "클릭되는 div"를 만들면 키보드 접근이 죽습니다.

## 2. CSS — 스타일은 "선택자 + 속성" 선언

CSS 는 명령형이 아니라 **선언형**입니다. "이 조건에 맞는 요소는 이렇게 보인다"를 나열하면 브라우저가 적용합니다. SQL 의 WHERE 절과 SET 절에 비유할 수 있습니다.

### 박스 모델과 flex — inventory-view 실예

모든 요소는 사각형 상자(content + padding + border + margin)입니다. 배치의 주력은 **flexbox**:

```tsx
// components/inventory-view.tsx — 도킹 위성 카드의 한 줄
<div className="flex items-center gap-3">
  <img ... className="h-10 w-20 object-contain" />   {/* 고정 크기 썸네일 */}
  <div className="flex-1">...</div>                   {/* 남는 공간을 전부 차지 */}
</div>
```

- `flex` = 가로 방향 유연 배치 시작, `items-center` = 세로 중앙 정렬, `gap-3` = 자식 간 간격
- `flex-1` = "남는 공간을 이 자식이 흡수" — 파이썬 f-string 의 `{x:<20}` 패딩 감각과 비슷하지만, **화면 크기가 변해도 자동으로 재계산**됩니다.

격자가 필요하면 `grid`: 인벤토리의 쓰레기 6종은 `grid grid-cols-3 gap-2`(3열 격자) 한 줄로 배치됩니다.

### Tailwind — 클래스 이름이 곧 스타일

이 프로젝트는 Tailwind v4 를 씁니다. `className="mt-4 font-mono text-xs"` 처럼 **유틸리티 클래스를 조합**하는 방식입니다. "클래스명이 지저분해 보인다"는 첫인상은 자연스럽지만, 컴포넌트 단위로 스타일이 함께 있어 **파일 하나만 보면 전부 보인다**는 장점이 실무에서 큽니다.

## 3. CSS 변수 — 이 프로젝트의 디자인 토큰 시스템

`app/globals.css` 상단에 프로젝트 전체의 색·간격·타이포가 **CSS 변수(custom property)** 로 정의돼 있습니다:

```css
:root {
  --color-bg: #030a05;        /* 딥스페이스 배경 (그린 틴트 — CRT phosphor) */
  --color-primary: #35e07a;   /* 형광 그린 — 계기·주요 수치·CTA */
  --color-secondary: #ffb23e; /* 앰버 — 보조 강조 */
  --scanline-alpha: 0.14;     /* CRT 스캔라인 농도 */
  ...
}
```

파이썬으로 치면 **설정 모듈의 상수**입니다. 쓰는 쪽은 세 가지 방식을 혼용합니다:

```tsx
// ① Tailwind 임의값 문법
<span className="text-[var(--color-muted)]">...</span>
// ② 인라인 style
<div style={{ background: "var(--color-surface)" }}>
// ③ 변수를 "프롭처럼" 내려서 CSS 가 받아 쓰기 (crt-brackets 의 색 변형)
<Link className="crt-brackets btn-brackets"
      style={{ "--bracket-color": "var(--color-primary)" } as React.CSSProperties}>
```

③ 이 재미있는 부분입니다 — CSS 쪽(`globals.css` 의 `.crt-brackets::before`)이 `var(--bracket-color)` 를 읽도록 해 두면, 마크업에서 변수만 바꿔 색 변형을 만듭니다. **컴포넌트 파라미터를 CSS 로 전달하는 다리**인 셈입니다. (`as React.CSSProperties` 캐스팅은 TS 가 커스텀 변수명을 모르기 때문입니다.)

### ⚠️ 캔버스는 CSS 변수를 자동으로 못 읽는다

Canvas 2D 는 CSS 밖 세계라서, 게임 코드는 시작 시 한 번 이렇게 읽어옵니다:

```ts
// components/arcade-game.tsx 등 캔버스 4형제 공통 관용구
const styles = getComputedStyle(document.documentElement);
const grid = styles.getPropertyValue("--color-grid").trim() || "#1e5a46"; // 폴백 병기
```

폴백 하드코딩을 병기하는 것까지가 관용구입니다(테스트·격리 환경 대비).

## 4. 이 프로젝트의 커스텀 클래스 3대장

Tailwind 로 안 되는 것은 `globals.css` 에 직접 씁니다. 읽어볼 가치가 있는 세 가지:

### `.crt-brackets` — 그라디언트 8개로 그린 SF 모서리

네 모서리에만 브래킷( ⌜ ⌝ ⌞ ⌟ )을 그리는 프레임. 자식 요소나 SVG 없이 **`::before` 가상 요소 하나에 `linear-gradient` 8개**(모서리당 가로+세로 2개)를 `background` 로 겹쳐 만듭니다. "CSS 그라디언트는 사각형을 그리는 브러시"라는 발상 전환의 좋은 예입니다.

### `.crt-scanlines` — 화면 전체 CRT 질감

`repeating-linear-gradient(transparent 0 2px, rgba(0,0,0,var(--scanline-alpha)) 2px 3px)` — 2px 투명 + 1px 어두움의 반복이 곧 주사선입니다. `body` 에 클래스 하나 얹는 것으로 게임 전체 톤이 결정됩니다(관리자 트리는 이 body 클래스가 없어 영향 없음).

### `.game-fullbleed` — 자식이 부모를 바꾸는 `:has()`

```css
body:has(main.game-fullbleed) .version-badge,
body:has(main.game-fullbleed) .pwa-prompt { display: none; }
```

"main 에 game-fullbleed 가 있으면 **body 레벨의** 버전 배지·PWA 배너를 숨겨라." 예전 CSS 로는 불가능했던 **부모 선택자**(`:has`)로, 게임 화면이 자기 화면 밖 요소를 JS 없이 제어합니다. 아케이드·발사처럼 몰입형 화면에서 씁니다. ⚠️ 반대로 인벤토리 같은 일반 스크롤 화면에는 일부러 안 씁니다(버전 배지 유지).

그 외: `.game-surface` 는 iOS 롱프레스 확대경·텍스트 선택을 차단합니다(게임 조작 보호). ⚠️ **초대코드처럼 복사해야 하는 텍스트를 이 안에 넣으면 안 됩니다** — `inventory-view.tsx` 헤더 주석에 이 함정이 기록돼 있습니다.

## 5. JS 없는 애니메이션 — CSS 만으로 어디까지 가나

### 스프라이트 애니메이션: `steps()`

```css
/* globals.css — 줍스 2프레임 idle 애니메이션 */
animation: joop-sprite-idle 1s steps(2) infinite;
```

`steps(2)` 는 보간을 끄고 **2단계로 뚝뚝 끊어** 이동시킵니다. `background-position` 을 시트의 프레임 폭만큼 이동시키면 GIF 처럼 움직입니다 — rAF 루프도, React 상태도 없이. `components/joop-sprite.tsx` 와 `debris-icon.tsx` 가 이 방식으로 시트를 자릅니다(`backgroundSize` 확대 + `backgroundPosition` 음수 오프셋).

### 순수 CSS 타원 궤도 (스플래시)

`globals.css` 의 스플래시 애니메이션은 더 나갑니다: 부모를 `scaleY(0.3636)` 로 눌러 회전시키고, 점에서 **역회전+역스케일**을 걸어 점 자체는 똑바로 보이게 하면 — 결과 궤적이 정확한 타원이 됩니다. "변환의 합성으로 원하는 궤적을 만든다"는 그래픽스 사고의 미니 교본입니다.

### 접근성 규칙: prefers-reduced-motion

이 저장소의 **모든** 애니메이션에는 짝이 있습니다:

```css
@media (prefers-reduced-motion: reduce) { .joop-sprite-idle { animation: none; } }
```

OS 에서 "동작 줄이기"를 켠 사용자에게 움직임을 멈춰 주는 것. CSS 만이 아니라 캔버스 루프도 같은 값을 읽어 정지 렌더로 전환합니다(05 문서). 새 애니메이션을 추가할 때 이 짝을 빠뜨리면 리뷰에서 잡힙니다.

## 직접 해보기 (5분)

1. 브라우저에서 `npm run dev` 로 첫 화면을 열고 개발자도구(F12) → Elements 에서 `<body>` 의 `crt-scanlines` 클래스를 **체크 해제**해 보세요. 화면의 CRT 질감이 통째로 꺼집니다 — 클래스 하나의 힘.
2. Elements 에서 `:root` 를 선택하고 Styles 패널에서 `--color-primary` 를 `#ff2e97` 로 바꿔 보세요. 형광 그린이던 모든 것이 즉시 마젠타로 — 이것이 디자인 토큰입니다.
3. `app/globals.css` 에서 `.crt-brackets::before` 를 찾아 그라디언트 8개를 세어 보세요.

→ 다음: [03-JS-TS-파이썬-번역기.md](./03-JS-TS-파이썬-번역기.md)
