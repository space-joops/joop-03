# joop-03

space-joops 유니버스의 Next.js 프로젝트입니다.

> ⚠️ **이 프로젝트는 표준 Next.js와 다른 커스텀 버전을 사용합니다.** 코드를 작성하기 전에 `AGENTS.md`와 `node_modules/next/dist/docs/`의 관련 가이드를 먼저 확인하세요. API·컨벤션·파일 구조가 익숙한 Next.js와 다를 수 있습니다.

## 시작하기

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 결과를 확인할 수 있습니다. `app/page.tsx`를 수정하면 자동으로 반영됩니다.

## 환경변수

Supabase 연동을 위해 아래 환경변수가 로컬 `.env.local`(gitignore됨)에 필요합니다. 값은 팀원에게 문의하세요.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용, 절대 클라이언트 코드나 커밋에 노출하지 마세요.

## 인프라

- **GitHub**: [space-joops/joop-03](https://github.com/space-joops/joop-03) (private)
- **Vercel**: `ppabams-projects/joop-03` → https://joop-03.vercel.app (⚠️ 자동배포 아님, 수동 배포 필요)
- **Supabase**: space-joops 공유 프로젝트 `jd-04` 사용 (테이블/오브젝트는 `joop_03_` 접두사 필수)

자세한 내용, 제약사항, 배포 방법은 **[docs/infra.md](docs/infra.md)** 를 확인하세요.

## 작업 로그

의미 있는 작업을 마치면 **[docs/worklog](docs/worklog)** 에 기록을 남깁니다. 프로젝트가 어떻게 지금 모습이 되었는지 배우고 싶다면 여기서부터 읽어보세요.

## 참고 자료

- [Next.js Documentation](https://nextjs.org/docs) — 단, 위 경고대로 이 프로젝트는 커스텀 버전이므로 `node_modules/next/dist/docs/`를 우선 확인하세요.
- [Vercel 배포 문서](https://nextjs.org/docs/app/building-your-application/deploying)
