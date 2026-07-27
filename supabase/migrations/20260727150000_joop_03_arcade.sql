-- M5 아케이드(우주 수거) 운영 파라미터 시드 (EPIC 7 / EPIC 10)
-- ⚠️ 공유 jd-04. joop_03_ 객체만. 스키마 변경 없음 — config 값 시드뿐.
-- 참고: lib/config-specs.ts (fallback 과 동일 값), docs/worklog/2026-07-27-아케이드-M5.md
--
-- 미적용이어도 코드 폴백으로 동작하며, 관리자 콘솔 저장으로도 행이 생긴다.
-- 시드해 두는 이유: 콘솔에서 "미설정" 대신 현재값이 보여 운영자가 헤매지 않는다.

insert into joop_03_game_config (key, value) values
  ('arcade_thrust',            '1.2'::jsonb),   -- 분사 가속(u/s²)
  ('arcade_max_speed',         '0.9'::jsonb),   -- 최대 속도(u/s)
  ('arcade_fuel',              '100'::jsonb),   -- 초기 분사가스
  ('arcade_fuel_burn',         '12'::jsonb),    -- 풀분사 시 초당 소모
  ('arcade_friction',          '0'::jsonb),     -- 마찰 0 = 관성 유지(FR-7.5)
  ('arcade_spawn_interval',    '1.1'::jsonb),   -- 쓰레기 생성 간격(초)
  ('arcade_fuel_item_ratio',   '0.12'::jsonb),  -- 연료 아이템 비율
  ('arcade_max_debris_per_run','2000'::jsonb),  -- 한 판 인정 상한(조각, 초과는 클램핑)
  ('arcade_require_link',      '1'::jsonb)      -- 1 = 수신 지역에서만 진입(FR-6.6)
on conflict (key) do nothing;
