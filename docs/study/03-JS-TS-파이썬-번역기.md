# 03. JS/TS ↔ 파이썬 번역기

> 새 언어를 배우는 가장 빠른 길은 이미 아는 언어에 매핑하는 것입니다. 이 문서는 파이썬 개념 → JS/TypeScript 대응을 우리 코드의 실제 줄로 확인합니다.

## 1. 빠른 대응표

| 파이썬 | JS/TS | 우리 코드 예시 |
|---|---|---|
| `[f(x) for x in xs]` | `xs.map(f)` | `timeline.map((e) => ...)` — 발사 이벤트 점 렌더 |
| `[x for x in xs if p(x)]` | `xs.filter(p)` | `AD_SATELLITES.filter((s) => !docked.has(s.id))` — 미도킹 브랜드 우선 스폰 |
| `sum(...)` / `functools.reduce` | `xs.reduce((a, b) => a + b, 0)` | `Object.values(counts).reduce(...)` — 인벤토리 총 수거량 |
| `dict.items()` | `Object.entries(obj)` | `Object.entries(parseKindCounts(raw))` |
| `x if c else y` | `c ? x : y` | 도처에 |
| `None` | `null` **과** `undefined` (2종!) | `getMyJoop(): MyJoop \| null` |
| f-string `f"{x}위"` | 템플릿 리터럴 `` `${x}위` `` | `` `/${lang}/joop/arcade` `` |
| `snake_case` | `camelCase` | DB 컬럼 `total_collected` ↔ TS 필드 `totalCollected` (`lib/rankings.ts` 의 `toRow` 가 이 변환 담당) |
| `@functools.lru_cache` | `React.cache` (요청 단위) | `getRankings = cache(async ...)` — ⚠️ 함정은 04 문서 |
| `assert isinstance(...)` | 타입 가드 함수 | `isLocale(lang)` — `lang is Locale` 반환 타입 |

`null` vs `undefined`: 관례적으로 **"의도적으로 비었음" = null, "아직 없음/전달 안 됨" = undefined** 로 씁니다. 우리 코드는 반환 타입에 주로 `null` 을 쓰고(`RankingRow | null`), 옵셔널 파라미터가 `undefined` 를 만듭니다.

## 2. TypeScript — "구조적 타이핑"이라는 다른 세계

파이썬 타입 힌트는 런타임에 무시되지만, TS 는 **컴파일 단계에서 강제**됩니다. 그리고 덕 타이핑을 정식화한 **구조적 타이핑**입니다 — 클래스 상속이 아니라 "모양이 맞으면 그 타입"입니다.

### 판별 유니온 — 이 저장소의 서버 액션 반환 규약

```ts
// app/[lang]/joop/arcade/actions.ts
export type ArcadeResult =
  | { ok: true; collected: number; totalCollected: number; ranking: ArcadeRankingDelta | null }
  | { ok: false; error: "invalid" | "auth" | "no_joop" | "not_orbit" | "save" };
```

파이썬으로 치면 `Union[Success, Failure]` + `Literal` 인데, 진짜 힘은 **좁히기(narrowing)** 입니다:

```ts
const res = await submitArcadeResult(n);
if (res.ok) {
  res.totalCollected  // ✅ ok:true 분기 안에서만 존재 — 컴파일러가 앎
} else {
  res.error           // ✅ 여기서만 존재. res.totalCollected 는 컴파일 에러
}
```

에러 코드가 문자열 리터럴 유니온(`"auth" | "no_joop" | ...`)이라 오타도 컴파일 에러입니다. **모든 서버 액션이 이 모양**이니, 새 액션을 만들 때도 따라 주세요.

### exhaustive switch — 컴파일러가 누락을 잡아준 실화

`components/telemetry-bar.tsx` 의 `launchEventLabel` 은 발사 이벤트 id 를 번역 라벨로 바꾸는 switch 인데, **default 가 없습니다.** 일부러입니다 — 반환 타입이 `string` 이므로 케이스가 하나라도 빠지면 "undefined 를 반환할 수 있음" 컴파일 에러가 납니다. 실제로 `LaunchEventId` 에 `"fairing"` 을 추가했을 때 **이 switch 가 라벨 누락을 빌드 실패로 잡아냈습니다**(worklog 2026-07-29 사운드·발사실사화 편). 파이썬의 `match` + `assert_never` 패턴과 같은 정신입니다.

### 타입을 "만들지 않고 추론시키는" 기술

```ts
// lib/i18n/dictionaries.ts — 사전 타입은 en.json 에서 통째로 추론
export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["en"]>>;
```

en.json 에 키를 추가하면 타입이 저절로 늘어나고, ko.json 에만 추가하면 **타입이 안 생겨서** 사용하는 순간 컴파일 에러 → "en 먼저"라는 저장소 규칙이 타입 시스템으로 강제됩니다. 스키마를 코드에서 파생시키는 pydantic 의 감각과 통합니다.

## 3. async/await ↔ asyncio

문법은 거의 같고, 차이는 **런타임**입니다. 파이썬은 이벤트 루프를 직접 띄우지만(`asyncio.run`), JS 는 언어 자체가 단일 스레드 이벤트 루프 위에서 돕니다 — 모든 I/O 가 원래 비동기입니다.

```ts
// app/[lang]/page.tsx — asyncio.gather 와 정확히 같은 감각
const [dict, snapshot, rankings, ...] = await Promise.all([
  getDictionary(lang), getOrbitalSnapshot(), getRankings(5), ...
]);
```

순차 `await` 5번이면 왕복 5배 — 독립 조회는 `Promise.all` 로 병렬화하는 것이 이 저장소의 관행입니다.

`.then()/.catch()` 체인도 보일 텐데(`claimAdDockReward(id).then(...)` — 아케이드 도킹 처리), rAF 루프처럼 **await 할 수 없는 동기 문맥에서 결과를 나중에 받아야 할 때** 씁니다. "fire-and-forget + 콜백"이라고 읽으면 됩니다.

## 4. 클로저 — 게임 루프의 상태는 어디에 사는가

아케이드 게임의 상태(위치·연료·수거량)는 React 상태가 아니라 **effect 함수 안의 지역 변수**입니다:

```ts
// components/arcade-game.tsx (개요)
useEffect(() => {
  let fuel = cfg.fuel;          // ← 이 변수들이 게임의 전부
  let collected = 0;
  const items = [];
  const frame = (ts) => {       // rAF 콜백이 위 변수들을 "기억"함 = 클로저
    fuel -= ...; items.push(...);
    raf = requestAnimationFrame(frame);
  };
  ...
}, [phase, ...]);
```

파이썬의 제너레이터/코루틴이 지역 변수로 상태를 유지하는 것과 같은 원리입니다. **왜 React 상태를 안 쓰나?** — 초당 60번 바뀌는 값을 `setState` 하면 초당 60번 리렌더가 나기 때문입니다. 화면 밖 DOM(점수판 등)에 보여줄 최소한만 골라서, 그것도 값이 바뀔 때만 `setState` 합니다. 이 경계선이 이 저장소 게임 코드의 핵심 설계입니다(04 문서에서 계속).

## 5. 이벤트 기반 프로그래밍

브라우저는 거대한 이벤트 버스입니다. 구독/해제 쌍이 기본기:

```ts
window.addEventListener("resize", onResize);
return () => window.removeEventListener("resize", onResize);  // effect 정리 함수에서 해제
```

**커스텀 이벤트로 모듈 간 통신**도 합니다 — `lib/sound-prefs.ts` 는 음소거 토글 시 `window.dispatchEvent(new Event("joop03:sound"))` 를 쏘고, 구독자들이 즉시 갱신됩니다. 브라우저 내장 `storage` 이벤트는 **다른 탭**의 변경만 알려주기 때문에, 같은 탭 반영용으로 커스텀 이벤트를 추가한 것입니다(이 조합의 이유가 파일 주석에 있습니다). Redis pub/sub 의 초미니 버전이라고 생각하면 됩니다.

## 6. 모듈 시스템 한 장

```ts
import { blip } from "@/lib/sound";     // named import. "@/" = 저장소 루트 별칭
import * as sfx from "@/lib/sound";     // 네임스페이스 import — sfx.blip() (파이썬 import module 감각)
import type { Dictionary } from "...";  // 타입만 — 런타임 코드 0바이트 (번들에 안 들어감)
```

`import type` 이 특히 중요합니다: 클라이언트 컴포넌트가 서버 전용 모듈의 **타입만** 참조할 수 있게 해 줍니다(`ranking-list.tsx` 가 `RankingRow` 타입을 쓰지만 DB 코드는 번들에 없음).

`import "server-only"` 는 반대 방향의 안전장치 — 이 한 줄이 있는 모듈을 클라이언트에서 import 하면 **빌드가 실패**합니다. `lib/game-config.ts`, `lib/i18n/dictionaries.ts`, `lib/supabase/admin.ts` 가 이렇게 보호됩니다. 서비스 롤 키 유출 같은 사고를 컴파일 타임에 막는 장치입니다.

## 직접 해보기 (5분)

1. `components/telemetry-bar.tsx` 의 `launchEventLabel` switch 에서 케이스 하나를 주석 처리하고 `npx tsc --noEmit` 을 돌려 보세요. 컴파일러가 뭐라고 하는지 확인 후 되돌리세요.
2. `lib/i18n/dictionaries/en.json` 의 아무 키나 이름을 바꾸고 `npx tsc --noEmit` — 사용처 전부가 에러로 나열됩니다. (되돌리기!)
3. `grep -rn "server-only" lib/` 로 서버 전용 모듈 목록을 뽑아 보세요.

→ 다음: [04-React-Nextjs-멘탈모델.md](./04-React-Nextjs-멘탈모델.md)
