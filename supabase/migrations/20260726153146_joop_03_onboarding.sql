-- M2 온보딩: 프로필 · 초대코드 · 대기리스트 + 분양(줍스) 쓰기 정책
-- ⚠️ 공유 jd-04 프로젝트. 모든 객체 joop_03_ 접두사.
-- 참고: docs/architecture/data-model.md, docs/architecture/adr/0004-auth-invite.md

-- ─────────────────────────────────────────────────────────────
-- 1. 테이블
-- ─────────────────────────────────────────────────────────────

-- 사용자 게임 프로필 (auth.users 1:1 확장; 익명 세션 포함)
create table if not exists joop_03_profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text unique,
  color        text,
  created_at   timestamptz not null default now()
);

-- 초대 코드
create table if not exists joop_03_invite_codes (
  code         text primary key,
  issuer_id    uuid references auth.users (id) on delete set null, -- 발급자(친구 초대). M2 시드는 null(운영 코드)
  email        text,                                               -- 특정 이메일 대상 코드(선택)
  redeemed_by  uuid references auth.users (id) on delete set null,
  redeemed_at  timestamptz,
  status       text not null default 'active' check (status in ('active','used','revoked')),
  created_at   timestamptz not null default now()
);

-- 이메일 대기리스트(초대 코드가 없는 사용자)
create table if not exists joop_03_waitlist (
  id         bigint generated always as identity primary key,
  email      text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists joop_03_waitlist_email_idx on joop_03_waitlist (lower(email));

-- ─────────────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────────────
alter table joop_03_profiles     enable row level security;
alter table joop_03_invite_codes enable row level security;
alter table joop_03_waitlist     enable row level security;

-- 프로필: 표시명은 랭킹 등에서 공개 읽기, 쓰기는 본인만
drop policy if exists joop_03_profiles_read   on joop_03_profiles;
drop policy if exists joop_03_profiles_insert on joop_03_profiles;
drop policy if exists joop_03_profiles_update on joop_03_profiles;
create policy joop_03_profiles_read   on joop_03_profiles for select to anon, authenticated using (true);
create policy joop_03_profiles_insert on joop_03_profiles for insert to authenticated with check (auth.uid() = id);
create policy joop_03_profiles_update on joop_03_profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 초대코드/대기리스트: 클라(anon/authenticated) 직접 접근 정책 없음 → RLS가 거부.
--   검증·소진·등록은 서버(Server Action)가 service_role(RLS 우회)로만 수행한다.

-- 줍스: 인증 사용자가 본인 소유(owner_id=uid) 줍스를 생성/수정 (분양·설정)
drop policy if exists joop_03_joops_owner_insert on joop_03_joops;
drop policy if exists joop_03_joops_owner_update on joop_03_joops;
create policy joop_03_joops_owner_insert on joop_03_joops for insert to authenticated with check (auth.uid() = owner_id);
create policy joop_03_joops_owner_update on joop_03_joops for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

grant select on joop_03_profiles to anon, authenticated;
grant insert, update on joop_03_profiles to authenticated;
grant insert, update on joop_03_joops to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. 테스트/운영 초대 코드 시드 (재실행 안전)
-- ─────────────────────────────────────────────────────────────
insert into joop_03_invite_codes (code) values
  ('JOOP-ALPHA-01'),
  ('JOOP-ALPHA-02'),
  ('JOOP-ALPHA-03'),
  ('JOOP-BETA-01'),
  ('JOOP-BETA-02')
on conflict (code) do nothing;
