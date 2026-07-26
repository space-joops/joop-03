# ADR-0002 · PWA · 세로 화면 고정

- 상태: 제안됨(Proposed)
- 관련: FR-0.2 (PWA, 세로 고정, 버전업 대응)

## 배경 / 문제

모바일 세로 화면 전용 웹 게임을 **PWA**(홈 화면 설치·세로 고정·버전업 대응)로 제공해야 한다.

## 결정

커스텀 Next.js 16.2.12의 내장 메타데이터 API를 사용한다.

1. **매니페스트**: `app/manifest.ts` (`MetadataRoute.Manifest`) 로 제공.
   - `display: 'standalone'`, `orientation: 'portrait'`, `start_url: '/'`, `theme_color`/`background_color`(카세트퓨처리즘 다크), `icons`(192/512, maskable).
2. **뷰포트**: 루트 레이아웃에서 `export const viewport: Viewport`.
   - `width: 'device-width'`, `initialScale: 1`, `maximumScale: 1`, `userScalable: false`(게임 중 핀치줌 차단), `themeColor`(라이트/다크 media 배열), `colorScheme: 'dark'`.
3. **아이콘/스플래시**: 파일 기반 API(`app/icon.png`, `app/apple-icon.png`, `app/favicon.ico`) + `public/`. iOS 홈 화면용 `appleWebApp`(title, statusBarStyle, startupImage).
4. **버전업 대응**: 배포마다 `package.json` 버전 범프 → 화면 버전 뱃지([infra.md](../infra.md) 정책)와 연동. 매니페스트/서비스워커 갱신 시 사용자에게 업데이트 알림(후속).

## 오프라인 캐싱 (주의)

- **Next.js에 오프라인 지원은 내장되어 있지 않다.** 공식 문서는 **Serwist**를 권장하나, v16은 **Turbopack이 기본 번들러**이고 Serwist는 현재 webpack 설정을 요구한다.
- 결정: **오프라인/서비스워커는 초기 범위에서 제외**하고 M0 후반 또는 별도 마일스톤에서 다룬다. 그때 (a) Turbopack 호환 SW 방식 또는 (b) 해당 빌드만 webpack opt-out을 검토. 웹 푸시(알람, FR-6.6)도 이 시점에 함께.

## 세로 고정 보강

- 매니페스트 `orientation: 'portrait'`는 설치형(standalone)에서 유효. 브라우저 탭에서는 CSS(가로 시 안내 오버레이)로 보강.

## 영향

- 루트 레이아웃에 `viewport`/메타데이터가 추가되고, `app/manifest.ts`가 생긴다.
- 아이콘 에셋(카세트퓨처리즘)이 필요(디자인 시스템, M0).
- 설치 요건: 유효 매니페스트 + HTTPS(로컬 테스트는 `next dev --experimental-https`).

## 미해결

- 오프라인 범위(전면 오프라인 vs 앱쉘만).
- 웹 푸시 인프라(VAPID 키, Server Action) 시점.
