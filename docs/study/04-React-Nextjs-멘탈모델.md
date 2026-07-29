# 04. React·Next.js 멘탈모델 — 그리고 이 저장소의 시그니처 패턴 3종

> React 를 한 문장으로: **UI = f(state)**. 상태가 바뀌면 화면이 따라온다 — 데이터 엔지니어에게는 "원본 테이블이 바뀌면 뷰가 따라오는" 물질화 뷰, 또는 pandas 파이프라인의 재실행에 가장 가깝습니다. DOM 을 직접 편집하지 않고 **"이 상태면 화면은 이렇다"만 선언**하면, 차이 계산(diff)과 트리 편집은 React 가 합니다.

## 1. 훅 3형제 — 우리 코드로

### useState — 화면에 보이는 상태

```tsx
// components/arcade-game.tsx
const [phase, setPhase] = useState<Phase>("ready");   // "ready" | "playing" | "over" | ...
```

`setPhase("playing")` 를 부르면 컴포넌트 함수가 **통째로 다시 실행**되고(리렌더), JSX 반환값의 차이만 DOM 에 반영됩니다. "변수에 대입했는데 왜 화면이 안 바뀌지?"의 답: 대입이 아니라 **setter 를 불러야 React 가 압니다.**

### useEffect — 렌더 밖 세계와의 다리

구독·타이머·캔버스 루프처럼 "렌더 아닌 일"은 effect 에 둡니다. **정리 함수 반환**이 핵심 규약:

```tsx
useEffect(() => {
  const id = setTimeout(() => setAdToast(null), 6000);  // 도킹 토스트 6초 자동 소거
  return () => clearTimeout(id);                        // 언마운트/재실행 전 정리
}, [adToast]);
```

두 번째 인자(의존성 배열)에 있는 값이 바뀌면 **정리 → 재실행**됩니다. 이 동작이 아래 "함정 ②"의 원인입니다.

### useRef — 리렌더를 일으키지 않는 상자

`ref.current` 는 바꿔도 리렌더가 없습니다. "React 몰래 들고 다니는 mutable 포인터"입니다. 이 저장소에서는 **게임 루프와 React 사이의 다리**로 씁니다(아래 ②).

## 2. 시그니처 패턴 ① — useSyncExternalStore + localStorage

localStorage 는 React 밖 세계입니다. 이 저장소는 네 개의 스토어(`debris-kinds`, `launch-replay`, `sound-prefs`, `ad-docks`)를 전부 같은 관용구로 연결합니다. 원형은 `lib/debris-kinds.ts`:

```tsx
// 스토어 쪽 (lib/…): 스냅샷은 "원시 문자열", 구독은 이벤트
export function readKindStoreSnapshot(): string { return localStorage.getItem(KEY) ?? ""; }
export function subscribeKindStore(cb) { window.addEventListener("storage", cb); return () => ...; }

// 컴포넌트 쪽: 3인자 = (구독, 스냅샷, SSR 스냅샷)
const raw = useSyncExternalStore(subscribeKindStore, readKindStoreSnapshot, () => "");
const counts = parseKindCounts(raw);   // 파싱은 렌더 중 "순수 함수"로
```

규칙 세 가지, 전부 이유가 있습니다:

1. **스냅샷은 파싱 전 원시 문자열** — 문자열은 값이 같으면 `===` 라서 참조가 안정적입니다. 스냅샷에서 매번 `JSON.parse` 한 객체를 돌려주면 항상 새 참조 → 무한 리렌더.
2. **SSR 스냅샷은 `() => ""`** — 서버에는 localStorage 가 없으므로. 첫 렌더가 "빈 상태"와 같은 마크업이 되어 하이드레이션(서버 HTML 과 클라 첫 렌더 대조)이 안전합니다.
3. **같은 탭 즉시 반영이 필요하면 커스텀 이벤트 추가** — `storage` 이벤트는 다른 탭 전용이라서. `sound-prefs`/`ad-docks` 가 이 변형입니다.

ESLint 의 `react-hooks/set-state-in-effect`(렌더 직후 effect 에서 setState 금지) 규칙을 정공법으로 회피하는 패턴이기도 합니다 — 과거에 이 규칙에 걸려 컴포넌트를 이 관용구로 재작성한 이력이 worklog 에 있습니다.

## 3. 시그니처 패턴 ② — rAF 게임 루프와 "deps 함정"

**이 저장소에서 가장 많이 반복된 함정**이라 굵게 씁니다.

게임 루프는 `useEffect` 안에서 `requestAnimationFrame` 으로 돕니다. 그런데 effect 는 deps 가 바뀌면 **정리 후 재실행** — 즉 **게임이 통째로 리셋**됩니다. 그래서:

> ⚠️ **철칙: 게임 도중 바뀌는 값을 루프 effect 의 deps 에 넣지 않는다.**

그럼 루프가 최신 값을 어떻게 읽나? **ref 다리**입니다. 방향별로 두 종류:

```tsx
// (a) React → 루프 : props/state 를 ref 로 미러 (orbital-canvas.tsx 의 교과서형)
const snapshotRef = useRef(snapshot);
useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);  // 미러만 갱신
useEffect(() => { /* rAF 루프. snapshotRef.current 를 읽음 */ }, []);  // 루프는 1회 생성

// (b) 루프 → React : 루프가 부를 함수를 ref 로 노출
const endGameRef = useRef<() => void>(() => {});
// 루프 안에서: endGameRef.current = endGame;          (DOM 종료 버튼이 호출)
const onAdDockRef = useRef<(id: string) => void>(...); // 반대로 루프가 React 핸들러를 호출 (도킹 보상)
```

실전 계보: 발사 배속 `speedRef`(버튼은 state, 루프는 ref — deps 에 넣으면 배속 바꿀 때마다 발사가 처음부터), 아케이드 `endGameRef`/`onAdDockRef`, 도킹 토스트 `adToast`(state 지만 **deps 에 안 넣어서** 리렌더가 나도 루프 생존). 사운드 음소거는 아예 **오디오 엔진 내부에서 강제**해 게임 코드가 뮤트 상태를 읽을 필요 자체를 없앴습니다(`lib/sound.ts` — deps 오염 원천 차단).

루프 자체의 표준 골격(캔버스 4형제 공통): DPR 대응 resize → `document.hidden` 시 정지(`visibilitychange`) → `prefers-reduced-motion` 이면 정지 렌더 1회 → 정리 함수에서 `cancelAnimationFrame` + 리스너 해제. 새 캔버스를 만들 때 이 골격을 복사하는 것이 가장 안전합니다.

## 4. 시그니처 패턴 ③ — 하이드레이션 안전

서버가 만든 HTML 과 클라이언트 첫 렌더가 다르면 React 가 경고하고 화면이 깜빡입니다. 이 저장소의 3대 처방:

1. localStorage 의존 → SSR 스냅샷 `""` (위 ①).
2. 시간 의존 → **서버가 준 절대 시각만 계산에 사용** (`link-status.tsx` 는 `nextChangeAt` epoch 만 받아 남은 시간을 셈), 시계 표시는 마운트 전 `--:--:--` 플레이스홀더(`status-bar.tsx`).
3. URL 쿼리 의존 → 렌더 초기값이 아니라 **마운트 후 effect 에서 DOM 갱신** (`onboarding-form.tsx` 의 `?code=` 프리필 — 주석에 이유 명시).

## 5. Next.js App Router — 서버가 기본, 클라는 선언

### 서버/클라 경계와 dict 주입

`"use client"` 없는 컴포넌트는 서버에서만 실행됩니다(DB 조회 직접 가능, 번들 0). 경계를 넘는 데이터는 **props 로 직렬화**됩니다:

```tsx
// 서버 page.tsx: 조회 → 클라 셸에 통째로 주입
const dict = await getDictionary(lang);
return <ArcadeGame lang={lang} dict={dict} color={mine.color} ... />;
```

번역 사전을 통째로 내리는 이유: 사전 로더가 `server-only` 라 클라가 직접 import 할 수 없고, 그 덕에 **언어가 10개가 되어도 클라 번들 크기는 그대로**입니다(ADR-0001). 관리자 설정값(`shadowFraction` 등)도 같은 방식 — "클라가 서버와 같은 판정을 쓰도록" 주입합니다.

### Server Actions — 폼과 뮤테이션

`"use server"` 파일의 함수는 클라에서 직접 호출 가능한 RPC 가 됩니다. 이 저장소의 규약:

- 반환은 판별 유니온(03 문서). `redirect()` 는 **예외를 던지므로 try 밖에서**.
- 폼은 `useActionState(action.bind(null, lang), null)` → `[state, formAction, pending]`.
- **낙관적 동시성**: PostgREST 에서 UPDATE 조건 불일치는 에러가 아니라 **0행**입니다. 그래서 `.eq("status","queued")` 같은 가드 + `.select()` 로 **갱신된 행 수를 확인**하고, 0행이면 새로 읽어 재시도합니다(`completeLaunch`, `submitArcadeResult` 의 3회 재시도 루프). "이슈 #31 에서 배운 것"이라는 태그가 붙어 다니는 핵심 규약입니다.
- ⚠️ 보안: Server Action 은 화면을 거치지 않고 POST 로 직접 호출될 수 있습니다. **권한 검사는 액션 첫 줄에서** — 렌더 가드나 프록시를 믿으면 안 됩니다(01 문서 §6).

### 캐싱 3종 세트

| 층 | 도구 | 예 |
|---|---|---|
| 요청 내 중복 제거 | `React.cache` | `getRankings` — 한 요청에서 여러 컴포넌트가 불러도 쿼리 1회 |
| CDN | `Cache-Control: s-maxage` | `/api/orbital` — 관리자 설정값을 그대로 max-age 로 |
| 클라 계산 | 오프스크린 캔버스 | 지구 이미지 1회 축소 캐시 (05 문서) |

⚠️ `React.cache` 의 함정: **같은 요청에서 쓰기 전/후로 두 번 부르면 두 번째도 첫 값**이 돌아옵니다. 그래서 `lib/rankings.ts` 는 비캐시 원본(`fetchMyRanking`)을 분리 export 하고, "저장 전후 순위 비교"가 필요한 액션은 그것만 씁니다(파일 주석 참고).

### ⚠️ 우리 Next 16 특이사항 (AGENTS.md 가 경고하는 것)

- `middleware.ts` → **`proxy.ts`** 로 개명.
- 생성형 라우트 타입 `PageProps<"/[lang]/joop">` 은 **빌드 후에만 갱신** → 신규 라우트는 `params: Promise<{ lang: string }>` 직접 타이핑(+ 이유 주석). `inventory/page.tsx` 가 최신 예.
- `params` 가 **Promise** 입니다 — `const { lang } = await params;`
- 모르는 API 를 만나면 추측하지 말고 `node_modules/next/dist/docs/` 를 읽으세요.

## 직접 해보기 (5분)

1. `components/orbital-canvas.tsx` 에서 루프 effect 의 deps 가 `[]` 인 것과, 그 위의 ref 미러 effect 를 찾아 (a) 패턴을 눈으로 확인하세요.
2. `components/launch-sequence.tsx` 에서 `speedRef` 를 검색해 "버튼은 state, 루프는 ref" 두 세계가 어떻게 동기화되는지 따라가 보세요.
3. `app/[lang]/joop/arcade/actions.ts` 의 `submitArcadeResult` 에서 `.eq("total_collected", base)` 가드와 재시도 루프를 읽으세요 — 분산 시스템의 CAS(compare-and-swap)와 같은 모양임을 알아볼 수 있을 겁니다.

→ 다음: [05-캔버스-게임엔진-물리.md](./05-캔버스-게임엔진-물리.md)
