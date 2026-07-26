# 줍스(Joops) 디자인 구현 가이드 (Developer Guide)

이 문서는 `docs/design/README.md` 및 디자인 토큰 명세서에 따라, 개발자가 실제 코드로 **카세트퓨처리즘(Cassette Futurism)** 스타일의 UI를 구현하기 위한 가이드입니다. 

## 1. 디자인 시스템 적용 (Tailwind v4)

디자인 토큰은 `app/globals.css` 파일에 적용되었습니다. TailwindCSS v4의 `@theme inline` 기능을 사용하여 CSS 변수와 Tailwind 유틸리티 클래스를 연동하였습니다.

### 주요 색상 토큰

*   `bg-background`: 기본 배경색 (딥스페이스 블랙)
*   `bg-surface`: 패널/베젤 표면색 (차콜)
*   `text-primary`: 형광 강조 (형광 그린 `#39ff14`)
*   `text-secondary`: 보조 강조 (앰버/오렌지 `#ffb000`)
*   `text-muted`: 보조/비활성 텍스트
*   `text-danger` / `text-success`: 상태 표시 색상

### 타이포그래피

*   `font-display`: 주요 수치, 헤드라인 (모노스페이스/세그먼트 스타일)
*   `font-body`: 본문, 일반 텍스트 (다국어 지원 산세리프)
*   `font-mono`: 코드, 정확한 수치 표시

## 2. 핵심 UI 컴포넌트 구현 가이드

### 패널 및 베젤 (`.panel-bezel`)

카세트퓨처리즘의 핵심인 아날로그 기기 느낌을 주기 위해 패널 컴포넌트를 정의했습니다. Tailwind의 유틸리티 클래스나 커스텀 클래스를 조합하여 사용하세요.

```html
<!-- 두꺼운 베젤을 가진 패널 예시 -->
<div class="panel-bezel rounded-sm p-4 text-primary">
  내용
</div>
```

### 텍스트 발광 효과 (CRT Glow)

계기판 느낌을 극대화하기 위해 발광 효과를 추가할 수 있습니다. `app/globals.css`에 추가된 유틸리티를 활용하세요.

*   `.crt-glow-primary`: 형광 그린 텍스트에 발광 효과 추가
*   `.crt-glow-secondary`: 앰버 텍스트에 발광 효과 추가

```html
<h1 class="font-display text-primary text-4xl crt-glow-primary">
  62%
</h1>
```

### 스캔라인 효과 (Scanline)

`app/globals.css`의 `body` 요소에 기본적으로 미세한 스캔라인 패턴(가로줄 배경)이 적용되어 있습니다. 배경에 이 패턴이 렌더링되므로, 패널 컴포넌트의 투명도를 조절하여 스캔라인이 비치게 할 수도 있습니다.

## 3. 화면 레이아웃 및 제약 사항

*   **모바일 세로 전용 (Portrait Only)**: 모든 뷰는 `flex-col`, `max-w-md mx-auto` 등을 사용하여 세로 방향을 기준으로 구현합니다.
*   **Safe Area 고려**: PWA 앱 구동 시 모바일 기기의 노치/홈 인디케이터 침범을 방지하기 위해 `env(safe-area-inset-top)` 등을 패딩에 적용해야 합니다.
    ```css
    .safe-padding {
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
    }
    ```

## 4. Canvas 2D 렌더링 지침

`M1` 첫 화면의 핵심 요소인 지구본, 궤도, 줍스 마커 등은 **Canvas 2D** 환경에서 그려집니다.

1.  **디자인 토큰 연동**: Canvas 내 도형을 그릴 때 하드코딩된 색상을 피하고, CSS 변수(`var(--primary)`)를 읽어와서 적용합니다.
    ```javascript
    const style = getComputedStyle(document.body);
    const primaryColor = style.getPropertyValue('--primary');
    ctx.strokeStyle = primaryColor;
    ```
2.  **스프라이트시트**: 줍스나 우주 쓰레기 등 에셋은 `public/game/` 폴더에 위치한 비트맵 이미지를 로드하여 `drawImage()`를 통해 그립니다. 기준점(anchor) 설정에 유의하세요.
3.  **최적화**: 모바일 배터리와 성능을 고려해 `requestAnimationFrame` 최적화 및 불필요한 전체 지우기를 지양하세요.

## 5. 다국어 (i18n)

디자인 토큰은 다국어 환경을 지원하도록 유연하게 설계되어야 합니다.
*   버튼이나 뱃지의 너비를 고정(`w-32`)하지 말고 패딩(`px-4 py-2`)을 사용해 가변적인 텍스트 길이에 대응하세요.
*   독일어, 러시아어 등 길이가 긴 텍스트를 대비하여 컴포넌트 내 텍스트 줄바꿈 혹은 말줄임(`truncate`) 처리가 필요합니다.
