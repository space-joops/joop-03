# 10. TODO — 첫 미션 (워밍업 퀘스트)

> **반나절 이하**로 끝나는, 그러나 전부 실제 사용자 경험을 개선하는 퀘스트들입니다. 목적은 두 가지 — 게임을 더 좋게 만들면서, **이 코드베이스의 관용구를 몸으로 익히는 것**. 첫 PR 은 여기서 고르세요.
>
> 퀘스트 형식: 난이도(⭐~⭐⭐⭐) · 왜 중요한가 · 건드릴 파일 · 힌트 · 검증 · ⚠️ 함정. 이슈 번호(#n)는 GitHub 이슈, FR-x 는 `docs/product/requirements.md` 연결입니다.

---

## Q1. queued 줍스가 "지상"으로 표시되는 것 고치기 ⭐ 👈 첫 PR 추천

**왜**: 발사를 예약한(queued) 순간은 이 게임에서 가장 설레는 상태인데, 첫 화면 내 줍스 카드에는 여전히 "지상"이라고 뜹니다(#34-1). 사용자의 성취가 화면에 반영되지 않는 것 — 몰입의 작은 구멍이지만 매일 보이는 구멍입니다.

**파일**: `lib/i18n/dictionaries/en.json` → `ko.json` (home 그룹에 `queued` 키), `components/first-screen-client.tsx:142` 부근.

**힌트**:
1. 현재 코드는 `myJoop.status === "orbit" ? dict.home.orbit : dict.home.ground` — **이진 분기**라 queued 가 ground 로 떨어집니다. 3분기로 바꾸세요.
2. dict 는 **en.json 먼저**(타입 소스 — 03 문서 §2), ko.json 동기화. 예: en `"Launch queued"` / ko `"발사 대기"`.
3. `app/[lang]/joop/page.tsx` 의 대시보드 카드에도 같은 이진 분기가 있는지 grep 으로 확인해 보세요 (`dict.home.ground` 검색).

**검증**: `npx tsc --noEmit`(ko 만 추가하면 여기서 잡힘) + 로컬에서 확인이 어려우면(DB 필요) PR 프리뷰에서 queued 계정으로 확인.

**⚠️ 함정**: ko.json 에만 추가하면 타입 에러가 **안 나고** 런타임에 undefined 가 뜹니다. 반드시 en 먼저.

---

## Q2. 훈련 결과 미저장 이탈 경고 ⭐

**왜**: 지상 훈련을 마치고 "수거 반영"을 안 누른 채 뒤로가기 하면 **한 판이 통째로 증발**합니다(#34-6). 잃은 줄도 모르고 잃는 것이 최악의 UX 입니다.

**파일**: `components/ground-minigame.tsx` (over/saved phase 근처).

**힌트**:
1. 가장 저렴한 해법은 결과 화면(over)의 "홈으로/뒤로" 계열 버튼을 누를 때 `summary && !result` 이면 확인을 한 번 거치는 것. 이 저장소에는 이미 **2단 확인 버튼 선례**가 있습니다 — `components/return-earth-button.tsx` 의 arming 패턴(첫 클릭 = 무장, 두 번째 클릭 = 실행, 잠시 후 자동 해제)을 그대로 이식하세요.
2. dict 키 추가(`minigame.leaveWarn` 등) — en 먼저.
3. 욕심을 내면 `beforeunload` 리스너까지(브라우저 뒤로가기 방어). 단 모바일 PWA 에서는 동작이 제한적이니 버튼 확인이 본체입니다.

**검증**: 훈련 → 종료 → 저장 안 하고 홈 버튼 → 경고가 뜨는지. 저장 후에는 경고 없이 나가지는지.

---

## Q3. VersionBadge 터치 통과시키기 ⭐ (5분 퀘스트)

**왜**: 우하단 버전 배지가 `z-50` 인데 `pointer-events` 차단이 없어서, 그 아래 UI 를 터치하면 배지가 먹습니다(#36-8).

**파일**: `app/version-badge.tsx` — className 에 `pointer-events-none` 한 단어.

**검증**: 배지 위를 클릭했을 때 아래 요소가 반응하는지. 이 퀘스트의 진짜 목적은 **첫 PR 사이클(브랜치→커밋→PR→프리뷰)을 가장 안전한 변경으로 한 바퀴 도는 것**입니다.

---

## Q4. 첫 화면 빈 상태 문구 ⭐⭐

**왜**: 서비스 초기(또는 NPC 시드 삭제 후 — #46)에 랭킹·궤도가 비면 **아무 설명 없는 빈 화면**이 됩니다(#33-4). 첫 방문자가 보는 화면이 비어 있으면 "죽은 서비스"로 읽힙니다.

**파일**: `components/ranking-list.tsx`(rows 가 빈 배열일 때), `components/first-screen-client.tsx`, dict.

**힌트**:
1. 빈 상태 처리의 저장소 선례: `components/launch-replay.tsx` 의 "기록 없음" 분기(문구 + 유도 링크 중앙 정렬), `components/inventory-view.tsx` 의 `debrisEmpty`(+아케이드 유도 링크).
2. 랭킹이 비면 "아직 궤도에 줍스가 없어요 — 첫 번째가 되어 보세요" + 온보딩 링크가 자연스럽습니다.

**검증**: `RankingList` 에 `rows={[]}` 를 넘기는 임시 렌더로 확인(또는 Playwright 하네스 — 05 문서 부록).

---

## Q5. 사운드 볼륨 슬라이더 ⭐⭐

**왜**: 지금은 켬/끔 2단뿐입니다. "소리는 좋은데 좀 크다"는 사용자를 잃지 않기.

**파일**: `lib/sound.ts`, `lib/sound-prefs.ts`, `components/sound-toggle.tsx`, dict.

**힌트**:
1. `lib/sound.ts` 의 `MASTER_GAIN`(0.32)이 유일한 마스터 볼륨입니다. `setMuted` 가 이미 게인 램프(0.02초 — 클릭 노이즈 방지)를 쓰고 있으니, 같은 방식으로 `setVolume(v: number)` 를 추가하면 됩니다(내부적으로 `master.gain.linearRampToValueAtTime(v * MASTER_GAIN, ...)`).
2. 저장은 `lib/sound-prefs.ts` 관용구 확장 — 키를 `joop03.sound.v1` 안에 `"on"/"off"` 대신 구조화된 값으로 바꾸려면 **버전 마이그레이션**(구 값 "on"/"off" 파싱 유지)이 필요합니다. 더 쉬운 길: 별도 키 `joop03.soundVol.v1`.
3. UI 는 `<input type="range">` — 토글 옆 팝오버로. 이 저장소 최초의 슬라이더이니 `design-tokens.md` 톤(트랙 그리드색, 썸 primary)을 맞춰 주세요.

**⚠️ 함정**: 볼륨 상태를 게임 루프 effect deps 에 넣지 마세요(04 문서의 철칙). 엔진 내부에서 강제하는 기존 설계(뮤트와 동일)를 따르면 deps 는 그대로입니다.

**검증**: 05 문서 부록의 AudioContext 스파이 하네스로 게인 값 확인, 또는 귀.

---

## Q6. 청약 확정 → 발사 CTA 연결 ⭐⭐

**왜**: 관리자가 탑승을 확정해 status 가 queued 로 바뀌어도, 사용자가 발사 화면으로 가는 **자연스러운 동선이 없습니다**(#34-2). 청약→발사는 이 게임의 클라이맥스인데 전환이 끊겨 있습니다.

**파일**: `components/first-screen-client.tsx`(내 줍스 카드), dict. (대시보드 `app/[lang]/joop/page.tsx` 에는 이미 queued 분기 launchNow 버튼이 있습니다 — 첫 화면이 문제.)

**힌트**:
1. Q1 을 먼저 하면 status 3분기가 이미 만들어져 있을 겁니다 — 그 위에 queued 일 때 `/{lang}/joop/launch` 링크(강조 스타일: `crt-brackets btn-brackets` + `--bracket-color: var(--color-primary)`)를 얹으세요.
2. "발사 준비 완료 — 카운트다운 시작하기" 같은 문구로 설렘을 파는 것까지가 이 퀘스트입니다.

**검증**: queued 계정으로 첫 화면 → CTA → 발사 시퀀스 진입.

---

**다 끝냈다면** → [11-TODO-몰입감.md](./11-TODO-몰입감.md) 에서 게임을 살아있게 만드는 퀘스트로.
