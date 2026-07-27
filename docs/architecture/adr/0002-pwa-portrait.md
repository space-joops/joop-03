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
3. **아이콘/스플래시**: 파일 기반 API(`app/icon.png`, `app/apple-icon.png`, `app/favicon.ico`) + `public/`. iOS 홈 화면용 `appleWebApp`(title, statusBarStyle, startupImage — 2026-07-27 기기별 5종 연결, `public/brand/splash-*.png`).
4. **버전업 대응**: 배포마다 `package.json` 버전 범프 → 화면 버전 뱃지([infra.md](../infra.md) 정책)와 연동. 사용자 업데이트 알림은 아래 "버전업 대응 구현" 절 참조(2026-07-27 구현).

## 오프라인 캐싱 (주의)

- **Next.js에 오프라인 지원은 내장되어 있지 않다.** 공식 문서는 **Serwist**를 권장하나, v16은 **Turbopack이 기본 번들러**이고 Serwist는 현재 webpack 설정을 요구한다.
- 결정: **오프라인/서비스워커는 초기 범위에서 제외**하고 M0 후반 또는 별도 마일스톤에서 다룬다. 그때 (a) Turbopack 호환 SW 방식 또는 (b) 해당 빌드만 webpack opt-out을 검토. 웹 푸시(알람, FR-6.6)도 이 시점에 함께.

## 버전업 대응 구현 (2026-07-27 추기)

설치 안내와 배포 업데이트 알림을 `components/pwa-prompt.tsx`(게임 루트 레이아웃에 마운트,
admin 트리 제외)로 구현했다. 결정 근거:

1. **새 배포 감지 = `/api/version` 폴링.** 서비스워커가 없고(위 결정 유지) 배포도
   수동(`vercel deploy --prod`)이라 서버 푸시 신호가 없다. `package.json` 버전이
   빌드타임에 인라인되므로, 클라이언트 상수와 `/api/version`(no-store) 응답의 단순
   불일치 비교로 감지한다. **배포 전 버전 범프가 감지의 전제다**(infra.md 체크리스트).
   설치형(standalone)에서만 5분 폴링 + 탭 복귀 시 즉시 체크. 적용은 안내 창 + 수동
   `location.reload()` — SW 캐시가 없어 리로드만으로 새 빌드를 받는다.
2. **`beforeinstallprompt` 커스텀 설치 버튼은 의도적 채택.** 번들 Next 가이드
   (progressive-web-apps.md)는 크로스브라우저가 아니라는 이유로 비권장하지만, 우리는
   iOS(Safari 공유→홈 화면 추가 / 타 브라우저는 Safari 유도)를 별도 단계 안내로
   커버하므로 지원 브라우저에서 원탭 설치 이득만 취한다. 미발화 3초 후 브라우저 메뉴
   일반 안내로 폴백(Firefox Android 등).
3. **매니페스트는 감지 채널로 쓰지 않는다.** `manifest.ts`는 기본 정적 캐시되는 특수
   라우트라(번들 가이드 manifest.md) 버전 신호에 부적합.
4. 알려진 한계: 안드로이드에 이미 설치된 상태로 브라우저 탭 접속 시 BIP가 발화하지
   않아 일반 안내가 노출될 수 있다(세션 닫기로 완화). iOS 16.4+ 일부 타 브라우저도
   실제로는 홈 화면 추가가 가능하지만 가장 신뢰 가능한 Safari 경로로 안내를 통일했다.

## 세로 고정 보강

- 매니페스트 `orientation: 'portrait'`는 설치형(standalone)에서 유효. 브라우저 탭에서는 CSS(가로 시 안내 오버레이)로 보강.

## 영향

- 루트 레이아웃에 `viewport`/메타데이터가 추가되고, `app/manifest.ts`가 생긴다.
- 아이콘 에셋(카세트퓨처리즘)이 필요(디자인 시스템, M0).
- 설치 요건: 유효 매니페스트 + HTTPS(로컬 테스트는 `next dev --experimental-https`).

## 미해결

- 오프라인 범위(전면 오프라인 vs 앱쉘만).
- 웹 푸시 인프라(VAPID 키, Server Action) 시점.
