# 2026-07-26 · GitHub / Vercel / Supabase 인프라 셋업

joop-03 프로젝트를 처음으로 외부 인프라(GitHub, Vercel, Supabase)에 연결한 작업 기록입니다. 앞으로 비슷한 셋업을 할 사람, 또는 왜 지금 이런 구조인지 궁금한 사람을 위해 남깁니다.

## 무엇을 했나

1. **GitHub**: `space-joops/joop-03` private 리포지토리 생성, 로컬 코드를 최초로 푸시
2. **Vercel**: `ppabams-projects` 팀에 프로젝트 연결, 프로덕션 배포
3. **Supabase**: space-joops에서 이미 쓰던 `jd-04` 프로젝트에 CLI로 로그인·링크하고, 환경변수를 로컬(`.env.local`)과 Vercel(production/preview/development)에 등록

## 부딪힌 문제와 왜 이렇게 결정했나

### Vercel Git 자동연동이 막혔어요

`vercel git connect`를 실행했더니 이런 에러가 났습니다.

> The repository "joop-03" is private and owned by an organization, which is not supported on the Hobby plan. Upgrade to Pro to continue. (409)

Vercel Hobby(무료) 플랜은 **"조직이 소유한 private 리포"의 자동배포를 지원하지 않습니다.** 선택지는 세 가지였어요.

1. Vercel 팀을 Pro 플랜으로 업그레이드 (비용 발생)
2. GitHub 리포지토리를 Public으로 전환 (코드 공개)
3. 자동배포 없이 수동 배포만 사용

팀 합의 없이 결제를 진행하거나 코드를 공개할 수 없다고 판단해서 **3번(수동 배포)** 을 선택했습니다. 즉, PR을 main에 머지해도 자동으로 배포되지 않고, 배포하려는 사람이 직접 `vercel deploy --prod`를 실행해야 합니다. 이 트레이드오프가 불편해지면 [docs/infra.md](../infra.md)를 보고 1번/2번을 다시 검토하세요.

### Supabase는 새로 만들지 않고 기존 `jd-04`를 재사용했어요

space-joops 계정에는 이미 Supabase 프로젝트가 두 개(`jd-02`, `jd-04`) 있었습니다. joop-03 전용 프로젝트를 새로 만드는 대신, 인프라를 한곳에서 관리하기 위해 **`jd-04`를 함께 쓰기로** 했습니다.

여러 프로젝트가 같은 데이터베이스를 쓰기 때문에, **joop-03이 만드는 모든 테이블·뷰·함수·storage bucket에는 `joop_03_` 접두사를 붙이기로** 정했습니다. 이 규칙을 지키지 않으면 다른 space-joops 프로젝트와 이름이 충돌할 수 있으니, 마이그레이션이나 스키마 작업을 할 때 꼭 기억하세요.

### Supabase 로그인이 브라우저로 안 열렸어요

에이전트 작업 환경은 non-TTY라 `supabase login`의 브라우저 자동 로그인 플로우가 동작하지 않았습니다. 대신 [Supabase 대시보드 → Access Tokens](https://supabase.com/dashboard/account/tokens)에서 토큰을 발급받아 `supabase login --token <token>`으로 로그인했습니다. 로컬 개발 환경(TTY)에서는 그냥 `supabase login`으로 브라우저 로그인이 될 거예요.

### 화면에 버전을 표시하기로 했어요

배포마다 `package.json`의 `version`이 달라지고, 이 값이 실제 제품 화면(우측 하단 작은 뱃지, `app/version-badge.tsx`)에 노출되도록 만들었습니다. 목적은 장애대응·고객 응대입니다 — 고객이 문제를 제보할 때 화면의 버전을 같이 알려주면, 정확히 어떤 배포에서 발생한 이슈인지 바로 특정할 수 있습니다.

배포하는 사람은 `vercel deploy --prod` 실행 전에 `npm version patch --no-git-tag-version`(또는 minor/major)으로 버전을 올려야 합니다. `--no-git-tag-version`을 쓰는 이유는 이 팀이 PR 기반으로 작업하기 때문에, `npm version`이 기본으로 만드는 git commit/tag를 건너뛰고 PR 안에서 일반 커밋으로 함께 리뷰하기 위해서입니다. 자세한 절차는 [docs/infra.md](../infra.md#배포-전-버전을-올려주세요-장애대응--고객-응대용)를 참고하세요.

## 배운 점 / 다음에 참고할 것

- 새 프로젝트를 Vercel에 연결하기 전에 "private + 조직 소유 리포 + Hobby 플랜"이면 자동배포가 안 된다는 걸 미리 체크리스트에 넣어두면 좋겠습니다.
- 공유 Supabase 프로젝트를 쓰면 관리 포인트는 줄지만, 네이밍 컨벤션(접두사)을 어기는 순간 바로 사고로 이어집니다. 스키마 변경 PR은 특히 꼼꼼히 리뷰하세요.
- 민감한 키(`SUPABASE_SERVICE_ROLE_KEY` 등)는 `.env.local`(gitignore됨)과 Vercel 환경변수에만 저장했고, 어떤 커밋에도 포함하지 않았습니다.

## 관련 문서

- [docs/infra.md](../infra.md) — 인프라 현황 레퍼런스 (이 로그보다 최신 상태를 반영)
