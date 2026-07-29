# 📚 줍스(JOOPS) 학습 가이드 — 사람을 위한 인수인계 문서

> 이 폴더는 **AI 가 작성한 이 코드베이스를 사람이 이어받아 유지보수하고 발전시키기 위한** 학습 문서입니다.
> 특히 **파이썬 데이터 엔지니어 출신 개발자**가 프론트엔드 경험 없이도 여기서부터 시작해
> "상상하는 모든 것"을 만들 수 있게 되는 것이 목표입니다.

## 누구를 위한 문서인가

- 파이썬으로 데이터 파이프라인·백엔드는 익숙하지만 HTML/CSS/JS/React 는 처음이거나 얕은 분
- 이 저장소에 처음 합류해서 "어디서부터 읽어야 하지?"가 막막한 분
- 코드는 대충 읽히는데 "왜 이렇게 짰는지"가 궁금한 분

이미 프론트엔드가 익숙하다면 02~03 은 건너뛰고 **01(지도) → 04~05(이 저장소의 관용구·물리) → 10~13(퀘스트)** 순서로 읽으면 됩니다.

## 읽는 순서

```
개념 편 (읽기)                          퀘스트 편 (직접 개발)
─────────────────────────              ─────────────────────────
README.md      ← 지금 여기              10-TODO-첫-미션.md      ⭐ 반나절짜리 워밍업
01-코드베이스-지도.md                    11-TODO-몰입감.md       ⭐⭐ 게임을 살아있게
02-HTML-CSS-첫걸음.md                   12-TODO-리텐션.md       ⭐⭐~⭐⭐⭐ 다시 오게 만들기
03-JS-TS-파이썬-번역기.md                13-TODO-안정성.md       ⭐⭐ 몰입은 안 끊길 때 생긴다
04-React-Nextjs-멘탈모델.md
05-캔버스-게임엔진-물리.md
```

추천 경로: **01 → 02 → 03 → 04 → 05 를 읽고, 10 에서 퀘스트 하나를 골라 첫 PR 을 만들어 보세요.**
각 개념 문서 끝에는 5분짜리 "직접 해보기"가 있습니다 — 코드를 열어 눈으로 확인하는 것만으로도 이해가 크게 달라집니다.

## 개발 환경 시작하기

```bash
npm install
npm run dev        # http://localhost:3000 — 대부분의 화면이 뜹니다
npm run lint       # ESLint (react-hooks 규칙이 엄격합니다 — 04 문서 참고)
npx tsc --noEmit   # 타입 검사만 (빌드 없이 빠르게)
npm run build      # 프로덕션 빌드 (생성형 라우트 타입도 이때 갱신됩니다)
```

### Supabase 환경변수 없이 되는 것 / 안 되는 것

이 프로젝트는 Supabase(DB·인증)를 쓰지만, **환경변수가 없어도 꽤 많은 화면이 동작**하도록 설계돼 있습니다.

| 환경변수 없이 됨 | 안 됨 (500 에러) |
|---|---|
| `/{lang}/joop/launch/replay` — 발사 다시 보기(localStorage 만 사용) | 첫 화면 `/{lang}` (랭킹·스냅샷 조회) |
| `/{lang}/joop/inventory` — 인벤토리(localStorage 만 사용) | 온보딩·대시보드·아케이드·훈련 (세션·설정 조회) |
| 정적 에셋·매니페스트 | 관리자 콘솔 전체 |

개발 중 게임 화면(아케이드·훈련)을 DB 없이 보고 싶을 때는 **임시 하네스 라우트**를 만드는 관행이 있습니다
(예: `app/[lang]/zzarcade/page.tsx` 에서 `<ArcadeGame>` 을 가짜 props 로 직접 렌더 — **커밋 전 반드시 삭제**).
과거 검증에 쓴 실제 예시가 `docs/worklog/2026-07-29-사운드-발사실사화-사출연출.md` 검증 절에 있습니다.

### 게임 에셋 재생성

```bash
GAME_BG_CHROMIUM=/opt/pw-browsers/chromium npm run gen:game   # 환경에 따라 경로 조정
```

`public/design-src/game/` 의 SVG 마스터를 → `public/game/` 런타임 에셋으로 변환/복사합니다.
멱등(idempotent)이라 몇 번을 돌려도 결과가 같습니다. 자세한 파이프라인은 `scripts/generate-game-bg.mjs` 헤더 주석 참고.

## 이 저장소의 규칙 (CLAUDE.md / AGENTS.md 요약)

1. **모든 소통은 한국어** — 커밋 메시지, PR 설명, 코드 리뷰까지.
2. **PR 기반** — main 에 직접 커밋하지 않습니다.
3. **의미 있는 작업 후 `docs/worklog/YYYY-MM-DD-제목.md`** — "문제 상황 → 선택지 → 왜 그렇게 결정했는지"를 친절하게. 나중에 합류한 사람(= 지금의 여러분)이 읽고 배우라고 쓰는 문서입니다.
4. **인프라가 바뀌면 `docs/infra.md` 도 함께 갱신.**
5. ⚠️ **이 프로젝트의 Next.js 16 은 여러분이 아는(그리고 AI 가 학습한) Next.js 와 다릅니다.** API·규약이 다른 커스텀 빌드라서, 코드를 쓰기 전에 `node_modules/next/dist/docs/` 의 해당 가이드를 먼저 읽어야 합니다. 실제로 겪은 차이: `middleware.ts` 가 `proxy.ts` 로 개명됨, 생성형 `PageProps` 타입은 빌드 후에만 갱신됨.

## 문서 지도 — 무엇을 어디서 찾나

| 알고 싶은 것 | 문서 |
|---|---|
| 이 게임이 뭔지, 세계관·핵심 루프 | `docs/product/overview.md` |
| 기능 요구사항 전체 (EPIC 0~10, FR 42개) | `docs/product/requirements.md` — 코드 주석의 `(FR-7.5)` 태그가 여기로 연결됩니다 |
| 마일스톤 진행 상태 | `docs/product/roadmap.md` |
| 왜 이 기술을 골랐나 (i18n·PWA·Canvas·인증·캐싱) | `docs/architecture/adr/0001~0005` |
| 궤도 수학의 근거 | `docs/architecture/orbit-model.md` + 이 폴더의 05 문서 |
| DB 스키마 | `docs/architecture/data-model.md` + `supabase/migrations/` (SQL 이 최종 진실) |
| 디자인 토큰·에셋 현황 | `docs/design/design-tokens.md`, `docs/design/asset-inventory.md` |
| 배포·환경변수·Vercel 제약 | `docs/infra.md` |
| "이건 왜 이렇게 돼 있지?" 의 역사 | `docs/worklog/` 30여 편 — 날짜순으로 이 프로젝트의 모든 결정이 기록돼 있습니다 |

⚠️ **알려진 문서 부채** (읽다가 당황하지 않도록):
- 코드 주석이 참조하는 `docs/design/handoff-m1.md`, `handoff-m4`, `handoff-m5` 는 **실재하지 않는 파일**입니다(끊어진 참조). 해당 내용의 실체는 worklog 에 흩어져 있습니다.
- `docs/architecture/adr/` 5편의 상태가 전부 "제안됨(Proposed)"이지만 **실제로는 전부 구현됐습니다.** 상태 갱신이 안 된 것뿐입니다.
- DB 설정에 **테스트 완화값**이 들어 있습니다(`minigame_xp_per_debris` 25, `launch_required_level` 1 등) — 정식 운영 전 원복 목록은 `13-TODO-안정성.md` 참고.

## 한 문장 요약

이 코드베이스를 관통하는 철학은 세 가지입니다 — **순수 함수는 서버·클라이언트가 공유한다**(`lib/orbit.ts`), **게임 루프는 React 상태와 분리한다**(ref 다리), **모든 결정은 추적 가능하게 남긴다**(FR 태그·worklog·⚠️ 주석). 이 세 가지만 기억하면 어떤 파일을 열어도 길을 잃지 않습니다.

→ 다음: [01-코드베이스-지도.md](./01-코드베이스-지도.md)
