-- M3 지상·청약: 줍스 진행도(xp) + 발사체 리스트 + 청약/선별 + 미니게임 물리 파라미터
-- ⚠️ 공유 jd-04. 모든 객체 joop_03_ 접두사.
-- 참고: docs/product/requirements.md (EPIC 3,4), docs/architecture/data-model.md

-- ─────────────────────────────────────────────────────────────
-- 1. 줍스 진행도(xp). level 은 1 + floor(xp/100) 로 갱신(캐시).
-- ─────────────────────────────────────────────────────────────
alter table joop_03_joops add column if not exists xp int not null default 0;

-- ─────────────────────────────────────────────────────────────
-- 2. 발사체 리스트
-- ─────────────────────────────────────────────────────────────
create table if not exists joop_03_launch_vehicles (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  provider       text not null,
  site           text not null,
  launch_at      timestamptz not null,
  capacity       int  not null,
  required_level int  not null default 1,
  status         text not null default 'scheduled'
                   check (status in ('scheduled','launched','cancelled')),
  created_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 3. 발사 청약/선별 (자동 선별: confirmed | pending | rejected)
-- ─────────────────────────────────────────────────────────────
create table if not exists joop_03_launch_bookings (
  id          bigint generated always as identity primary key,
  vehicle_id  uuid not null references joop_03_launch_vehicles (id) on delete cascade,
  joop_id     uuid not null references joop_03_joops (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  created_at  timestamptz not null default now(),
  unique (vehicle_id, owner_id)  -- 발사체당 1회 청약
);
create index if not exists joop_03_launch_bookings_owner_idx on joop_03_launch_bookings (owner_id);
create index if not exists joop_03_launch_bookings_vehicle_idx on joop_03_launch_bookings (vehicle_id);

-- ─────────────────────────────────────────────────────────────
-- 4. RLS — 발사체 공개 읽기, 청약은 본인 읽기. 쓰기·선별은 service_role(서버)만.
-- ─────────────────────────────────────────────────────────────
alter table joop_03_launch_vehicles enable row level security;
alter table joop_03_launch_bookings enable row level security;

drop policy if exists joop_03_launch_vehicles_read on joop_03_launch_vehicles;
create policy joop_03_launch_vehicles_read
  on joop_03_launch_vehicles for select to anon, authenticated using (true);

drop policy if exists joop_03_launch_bookings_read on joop_03_launch_bookings;
create policy joop_03_launch_bookings_read
  on joop_03_launch_bookings for select to authenticated using (auth.uid() = owner_id);

grant select on joop_03_launch_vehicles to anon, authenticated;
grant select on joop_03_launch_bookings to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. 미니게임 물리 파라미터 (FR-7.5 / EPIC 10 대비, 읽기 전용)
-- ─────────────────────────────────────────────────────────────
insert into joop_03_game_config (key, value) values
  ('minigame_thrust',    '0.35'::jsonb),   -- 추력(가속)
  ('minigame_max_speed', '6'::jsonb),      -- 최대 속도
  ('minigame_fuel',      '100'::jsonb),    -- 초기 연료(분사가스)
  ('minigame_friction',  '0'::jsonb),      -- 마찰 0 (관성)
  ('minigame_xp_per_debris', '8'::jsonb),  -- 쓰레기당 xp
  ('launch_required_level',  '3'::jsonb)   -- 기본 발사 자격 레벨(참고)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 6. 실 발사체 시드 (재실행 안전 — 비어있을 때만)
-- ─────────────────────────────────────────────────────────────
insert into joop_03_launch_vehicles (name, provider, site, launch_at, capacity, required_level)
select * from (values
  ('Falcon 9',     'SpaceX',      'Cape Canaveral, USA',   now() + interval '10 days', 20, 3),
  ('Electron',     'Rocket Lab',  'Mahia, New Zealand',    now() + interval '6 days',  10, 2),
  ('Ariane 6',     'Arianespace', 'Kourou, French Guiana', now() + interval '21 days', 25, 4),
  ('Long March 5', 'CASC',        'Wenchang, China',       now() + interval '14 days', 20, 3),
  ('Soyuz-2',      'Roscosmos',   'Baikonur, Kazakhstan',  now() + interval '8 days',  15, 2)
) as v(name, provider, site, launch_at, capacity, required_level)
where not exists (select 1 from joop_03_launch_vehicles);
