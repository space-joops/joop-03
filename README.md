# joop-03 · 줍스(Joops)

space-joops 유니버스의 Next.js 프로젝트입니다. **줍스**는 지구 궤도의 우주 쓰레기를 청소하는 반려형 우주 로봇을 키우고 함께 우주를 청소하는 모바일 세로 화면 전용 웹 게임(PWA)입니다. → [제품 개요](docs/product/overview.md)

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

## 문서 지도

무엇을 만들 것인지(제품)와 어떻게 만들 것인지(아키텍처)를 문서로 관리합니다.

**제품**
- [제품 개요](docs/product/overview.md) — 세계관·핵심 루프·디자인 방향
- [요구사항 명세](docs/product/requirements.md) — 이슈 #2를 11개 에픽/기능(FR)으로 구조화
- [로드맵](docs/product/roadmap.md) — 마일스톤 M0~M8
- [첫 화면 상세 스펙 (M1)](docs/product/screens/01-first-screen.md) — 다음 구현 대상

**아키텍처**
- [데이터 모델](docs/architecture/data-model.md) — Supabase 스키마(`joop_03_` 접두사)
- [궤도 모델](docs/architecture/orbit-model.md) — 좌표 공식·서버/클라 공유 로직
- [기술 결정(ADR)](docs/architecture/adr/) — i18n · PWA · Canvas 2D · 인증/초대 · SSR 궤도 API

**디자인** (디자이너 협업용)
- [디자인 요청 브리프](docs/design/design-brief.md) — 발주 요청서(목표·산출물·제약·전달 방법)
- [디자인 토큰 초안](docs/design/design-tokens.md) — 카세트퓨처리즘 색·타이포·컴포넌트
- [에셋 인벤토리](docs/design/asset-inventory.md) · [에셋 관리 규칙](docs/design/README.md)

## 작업 로그

의미 있는 작업을 마치면 **[docs/worklog](docs/worklog)** 에 기록을 남깁니다. 프로젝트가 어떻게 지금 모습이 되었는지 배우고 싶다면 여기서부터 읽어보세요.

## 참고 자료

- [Next.js Documentation](https://nextjs.org/docs) — 단, 위 경고대로 이 프로젝트는 커스텀 버전이므로 `node_modules/next/dist/docs/`를 우선 확인하세요.
- [Vercel 배포 문서](https://nextjs.org/docs/app/building-your-application/deploying)
