# 인프라 연동 현황

joop-03은 space-joops 유니버스의 다른 프로젝트들과 인프라 일부를 공유합니다. 새로 합류하는 분들은 이 문서로 전체 그림을 파악하세요. 인프라가 바뀌면 이 문서도 함께 갱신해주세요.

## GitHub

- 리포지토리: https://github.com/space-joops/joop-03
- 공개범위: Private (조직 `space-joops` 소속)
- 작업 방식: main 직접 커밋 금지, 브랜치 + PR

## Vercel

- 팀: `ppabams-projects` (Hobby 플랜)
- 프로젝트: `joop-03`
- 배포 URL: https://joop-03.vercel.app

### ⚠️ 자동배포가 아니라 수동배포입니다

Vercel Hobby 플랜은 **조직이 소유한 private GitHub 리포지토리의 Git 연동(자동배포)을 지원하지 않습니다.**
`vercel git connect` 시도 시 아래 에러가 발생합니다:

> The repository "joop-03" is private and owned by an organization, which is not supported on the Hobby plan. Upgrade to Pro to continue. (409)

그래서 PR이 main에 머지되어도 **자동으로 배포되지 않습니다.** 배포하려면 아래 명령을 직접 실행하세요:

```bash
vercel deploy --prod
```

자동배포를 쓰려면 다음 중 하나가 필요합니다 (아직 결정되지 않음, 필요 시 팀 논의):

1. Vercel 팀을 Pro 플랜으로 업그레이드
2. GitHub 리포지토리를 Public으로 전환

### 배포 전 버전을 올려주세요 (장애대응 / 고객 응대용)

배포마다 `package.json`의 `version`이 달라야 합니다. 이 값은 화면 우측 하단의 작은 뱃지(`app/version-badge.tsx`, 다중 루트 레이아웃인 `app/[lang]/layout.tsx`와 `app/admin/layout.tsx` 양쪽에 포함되어 모든 페이지에 노출)로 표시됩니다. 고객이 문의할 때 화면에 보이는 버전을 알려주면, 정확히 어떤 배포에서 발생한 문제인지 바로 특정할 수 있어 장애대응과 고객 응대가 빨라집니다.

**또한 이 버전 범프가 설치형(PWA) 사용자에게 업데이트 안내를 띄우는 트리거입니다.** `components/pwa-prompt.tsx`가 `/api/version`을 폴링해 실행 중 버전과 배포 버전이 다르면 업데이트 창을 띄웁니다 — 버전을 올리지 않고 배포하면 안내가 뜨지 않습니다([ADR-0002](architecture/adr/0002-pwa-portrait.md) "버전업 대응 구현" 참조).

배포 전 체크리스트:

```bash
npm version patch --no-git-tag-version   # 또는 minor / major — git commit·tag는 만들지 않음(PR 워크플로우와 충돌 방지)
```

1. 위 명령으로 `package.json`/`package-lock.json`의 버전을 올린다
2. 변경사항을 커밋해 PR에 포함하고 머지한다
3. `vercel deploy --prod`로 배포한다 → 화면의 버전 뱃지가 갱신된다

## Supabase

- 프로젝트: `jd-04` (ref: `gclewzipfpkmxjikqmav`, 리전: `ap-northeast-2`)
- **space-joops의 다른 프로젝트와 공유하는 데이터베이스입니다.**

### ⚠️ 반드시 지켜야 할 규칙: `joop_03_` 접두사

다른 프로젝트와 이름이 충돌하지 않도록, joop-03에서 만드는 모든 Supabase 오브젝트(테이블, 뷰, RPC 함수, storage bucket 등)에는 **`joop_03_` 접두사**를 붙입니다.

예: `joop_03_users`, `joop_03_posts`, `joop_03_upload_avatar()`

### CLI 사용법

Supabase CLI는 `devDependency`로 설치되어 있어 `npx`로 바로 사용할 수 있습니다.

```bash
# 최초 로그인 (브라우저 로그인이 안 되는 non-TTY 환경이라면 --token 사용)
# 토큰 발급: https://supabase.com/dashboard/account/tokens
npx supabase login --token <YOUR_ACCESS_TOKEN>

npx supabase projects list
npx supabase link --project-ref gclewzipfpkmxjikqmav   # 이미 링크되어 있음
```

### 환경변수

| 이름 | 용도 | 노출범위 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 프로젝트 URL | 클라이언트 공개 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | 클라이언트 공개 (RLS로 보호) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 키, RLS 우회 | **서버 전용, 절대 클라이언트 노출 금지** |
| `ADMIN_PASSWORD` | 관리자 콘솔(`/admin`) 로그인 비밀번호 | **서버 전용** |
| `ADMIN_SESSION_SECRET` | 관리자 세션 쿠키 HMAC 서명 키 | **서버 전용** |
| `ADMIN_SESSION_TTL_SECONDS` | (선택) 관리자 세션 수명. 기본 43200(12시간) | 서버 전용 |

로컬 `.env.local`(gitignore됨)과 Vercel 프로젝트의 Production/Preview/Development 세 환경 모두에 등록되어 있어야 합니다.

### 관리자 콘솔 환경변수 (M8)

`/admin`은 게임의 익명 세션과 분리된 자체 인증을 씁니다. 두 값이 **하나라도 없거나 짧으면
콘솔 전체가 잠깁니다**(로그인 실패 + 기존 세션도 거부). 의도된 fail-closed 동작입니다.

- `ADMIN_PASSWORD` — 12자 이상. 온라인 무차별 대입에 대한 실질적 방어선이 이 값의 엔트로피이므로
  사람이 외우는 문자열 대신 랜덤 값을 쓰세요.
- `ADMIN_SESSION_SECRET` — 32자 이상. 이 값을 바꾸면 모든 관리자 세션이 즉시 무효화됩니다.
  (비밀번호를 바꿔도 마찬가지입니다 — 서명 키가 두 값에서 함께 유도되기 때문입니다.)

```bash
# 생성
node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"  # ADMIN_PASSWORD
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"        # ADMIN_SESSION_SECRET

# Vercel 3환경 모두에 등록
vercel env add ADMIN_PASSWORD production   # preview, development 도 동일하게
vercel env add ADMIN_SESSION_SECRET production
```
