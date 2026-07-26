-- M4 발사·우주: idle 자동 수거 기준 시각 + 발사/수거 파라미터
-- ⚠️ 공유 jd-04. joop_03_ 접두사. 참고: requirements EPIC 5,6

-- idle 자동 수거 정산 기준(마지막 정산 시각). 발사(궤도 진입) 시 now 로 설정.
alter table joop_03_joops add column if not exists last_collected_at timestamptz;

-- 운영 파라미터 (읽기 전용, EPIC 10 대비)
insert into joop_03_game_config (key, value) values
  ('idle_collect_rate',        '120'::jsonb),  -- 시간당 자동 수거 조각 수
  ('idle_collect_cap_hours',   '12'::jsonb),   -- 1회 정산 시 반영할 최대 경과(시간)
  ('launch_countdown_seconds', '8'::jsonb)     -- 발사 카운트다운(초)
on conflict (key) do nothing;
