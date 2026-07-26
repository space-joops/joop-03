-- M1 첫 화면(궤도 대시보드) 스키마 + 시드
-- ⚠️ 공유 Supabase 프로젝트(jd-04)이므로 모든 객체에 반드시 joop_03_ 접두사.
-- 참고: docs/architecture/data-model.md, docs/product/screens/01-first-screen.md
-- 이 마이그레이션은 스키마·RLS·설정 시드에 더해, 원격 적용 시 데이터가 함께
-- 들어가도록 줍스 100개/수거 이벤트 시드를 idempotent(비어있을 때만)로 포함한다.

-- ─────────────────────────────────────────────────────────────
-- 1. 테이블
-- ─────────────────────────────────────────────────────────────

-- 줍스(로봇) 개체
create table if not exists joop_03_joops (
  id                      uuid primary key default gen_random_uuid(),
  owner_id                uuid references auth.users (id) on delete set null, -- M1 시드는 NPC(null)
  name                    text not null unique,
  color                   text not null,
  orbit_radius            numeric not null,   -- 궤도 반경(지구 반경 기준 정규화)
  orbit_inclination       numeric not null,   -- 궤도 경사 i (도)
  orbit_raan              numeric not null,   -- 승교점 경도 Ω (도)
  orbit_phase0            numeric not null,   -- 기준시각 초기 위상 φ₀ (rad)
  orbit_angular_velocity  numeric not null,   -- 각속도 ω (rad/s)
  status                  text not null default 'orbit'
                            check (status in ('ground','queued','launching','orbit')),
  level                   int  not null default 1,
  total_collected         bigint not null default 0,  -- 누적 수거량(비정규화 캐시)
  created_at              timestamptz not null default now()
);

-- 쓰레기 수거 이벤트(랭킹/주간 등락 소스)
create table if not exists joop_03_debris_events (
  id           bigint generated always as identity primary key,
  joop_id      uuid not null references joop_03_joops (id) on delete cascade,
  amount       int  not null,
  occurred_at  timestamptz not null default now()
);
create index if not exists joop_03_debris_events_joop_idx on joop_03_debris_events (joop_id);
create index if not exists joop_03_debris_events_time_idx on joop_03_debris_events (occurred_at);

-- 운영 파라미터(key-value)
create table if not exists joop_03_game_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. 주간 랭킹 뷰 (등락 = 현재 순위 vs 7일 이전 누적 기준 순위)
--    security_invoker: 호출자(anon) 권한으로 기반 테이블 RLS 적용 (PG15+)
-- ─────────────────────────────────────────────────────────────
create or replace view joop_03_rankings_weekly
with (security_invoker = true) as
with prev_total as (
  select j.id as joop_id,
    coalesce(sum(de.amount) filter (where de.occurred_at < now() - interval '7 days'), 0) as prev_collected
  from joop_03_joops j
  left join joop_03_debris_events de on de.joop_id = j.id
  group by j.id
),
week_total as (
  select j.id as joop_id,
    coalesce(sum(de.amount) filter (where de.occurred_at >= now() - interval '7 days'), 0) as collected_in_week
  from joop_03_joops j
  left join joop_03_debris_events de on de.joop_id = j.id
  group by j.id
)
select
  j.id                                              as joop_id,
  j.name,
  j.color,
  j.total_collected,
  rank() over (order by j.total_collected desc)     as rank,
  rank() over (order by p.prev_collected desc)      as prev_rank,
  w.collected_in_week
from joop_03_joops j
join prev_total p on p.joop_id = j.id
join week_total w on w.joop_id = j.id;

-- ─────────────────────────────────────────────────────────────
-- 3. RLS — 공개 읽기만 허용, 쓰기는 service_role(RLS 우회)만
-- ─────────────────────────────────────────────────────────────
alter table joop_03_joops         enable row level security;
alter table joop_03_debris_events enable row level security;
alter table joop_03_game_config   enable row level security;

drop policy if exists "joop_03_joops_anon_read"         on joop_03_joops;
drop policy if exists "joop_03_debris_events_anon_read" on joop_03_debris_events;
drop policy if exists "joop_03_game_config_anon_read"   on joop_03_game_config;

create policy "joop_03_joops_anon_read"
  on joop_03_joops for select to anon, authenticated using (true);
create policy "joop_03_debris_events_anon_read"
  on joop_03_debris_events for select to anon, authenticated using (true);
create policy "joop_03_game_config_anon_read"
  on joop_03_game_config for select to anon, authenticated using (true);

grant select on joop_03_joops             to anon, authenticated;
grant select on joop_03_debris_events     to anon, authenticated;
grant select on joop_03_game_config       to anon, authenticated;
grant select on joop_03_rankings_weekly   to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. 설정 시드
-- ─────────────────────────────────────────────────────────────
insert into joop_03_game_config (key, value) values
  ('orbital_tick_seconds', '10'::jsonb),      -- 좌표 스냅샷 주기(초)
  ('debris_target',        '5000000'::jsonb)  -- 전체 청소 목표(% 계산 기준)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 5. 데이터 시드 (비어있을 때만 — 재실행 안전)
-- ─────────────────────────────────────────────────────────────

-- 줍스 100개: 궤도 파라미터를 인덱스 기반으로 결정론적 분산
insert into joop_03_joops
  (name, color, orbit_radius, orbit_inclination, orbit_raan, orbit_phase0, orbit_angular_velocity, status, level)
select
  'Joop-' || lpad(g::text, 3, '0'),
  (array['#39ff14','#ffb000','#00e5ff','#ff3860','#c8ff00','#ff00d4'])[1 + (g % 6)],
  1.05 + (g % 20) * 0.02,                              -- 반경 1.05~1.43
  (g * 37 % 180)::numeric,                             -- 경사 0~179
  (g * 53 % 360)::numeric,                             -- 승교점 0~359
  ((g * 0.6180339887) - floor(g * 0.6180339887)) * 2 * pi(),  -- 위상 0~2π 황금비 분산
  0.0008 + (g % 15) * 0.00006,                         -- 각속도 다양
  'orbit',
  1 + (g % 5)
from generate_series(1, 100) as g
where not exists (select 1 from joop_03_joops);

-- 수거 이벤트: 각 줍스에 과거(8~14일 전) 1건 + 최근 1주(0~6일 전) 1건
--  → 현재 순위(total)와 7일 이전 순위(prev)가 달라져 '주간 등락'이 생김
insert into joop_03_debris_events (joop_id, amount, occurred_at)
select j.id,
  (500 + (row_number() over (order by j.name) * 13 % 900))::int,
  now() - ((8 + (row_number() over (order by j.name) % 7)) || ' days')::interval
from joop_03_joops j
where not exists (select 1 from joop_03_debris_events);

insert into joop_03_debris_events (joop_id, amount, occurred_at)
select j.id,
  (300 + (row_number() over (order by j.name) * 17 % 1200))::int,
  now() - ((row_number() over (order by j.name) % 7) || ' days')::interval
from joop_03_joops j
where (select count(*) from joop_03_debris_events) <= 100;

-- total_collected 캐시 = 해당 줍스의 수거 이벤트 합
update joop_03_joops j
set total_collected = coalesce(agg.s, 0)
from (select joop_id, sum(amount) as s from joop_03_debris_events group by joop_id) agg
where agg.joop_id = j.id
  and j.total_collected = 0;
