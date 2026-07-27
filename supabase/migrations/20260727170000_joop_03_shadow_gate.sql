-- 음영 게이트(XP 진입) + 궤도 게임 배속 운영 파라미터 시드
-- ⚠️ 공유 jd-04. joop_03_ 객체만. **스키마 변경 없음** — game_config 값 시드뿐.
-- 참고: lib/config-specs.ts(fallback 과 동일), docs/worklog/2026-07-27-음영게이트-지도통일.md
--
-- 배경: 실제 궤도는 한 바퀴 62~131분이고 음영은 정확히 반주기(31~65분)라 게임으로 기다릴 수
-- 없다. orbit_game_speed 로 위상 진행을 압축하고 shadow_fraction 으로 음영 호를 좁혀
-- 대기 시간을 45~90초로 만든다. 초기 개발 단계에는 음영이어도 XP 를 내면 바로 플레이한다.

insert into joop_03_game_config (key, value) values
  ('orbit_game_speed',       '30'::jsonb),   -- 궤도 위상 배속(첫 화면·지도·음영 판정 공통)
  ('shadow_fraction',        '0.35'::jsonb), -- 한 궤도 중 음영 비율(물리값은 0.5)
  ('arcade_shadow_xp_cost',  '20'::jsonb)    -- 음영 진입 XP 비용(0 = 무료)
on conflict (key) do nothing;
