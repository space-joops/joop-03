-- 지상 훈련 미니게임 개편 + 테스트 기간 발사 난이도 완화
-- ⚠️ 공유 jd-04. 모든 객체 joop_03_ 접두사.
-- 참고: docs/worklog/2026-07-27-지상훈련-식별미니게임-개편.md
--
-- 배경
--   지상 훈련이 "공중을 분사(추력)로 날아다니며 쓰레기 먹기" → "땅에서 좌우로만 움직여
--   떨어지는 물체를 식별(받기/피하기)"로 바뀌었다. 물리 파라미터의 의미가 완전히 달라져
--   기존 키를 재해석하는 대신 새 키로 교체한다.
--
--   지운 키는 lib/config-specs.ts 레지스트리에서도 빠졌으므로, 여기서 지우지 않으면
--   관리자 콘솔의 "레지스트리에 없는 키"에 영구히 남아 운영자를 혼란스럽게 한다.

-- ─────────────────────────────────────────────────────────────
-- 1. 관성·분사 물리 키 제거 (우주 아케이드 M5에서 필요해지면 그때 다시 정의)
-- ─────────────────────────────────────────────────────────────
delete from joop_03_game_config
 where key in ('minigame_thrust', 'minigame_max_speed', 'minigame_fuel', 'minigame_friction');

-- ─────────────────────────────────────────────────────────────
-- 2. 새 지상 훈련 파라미터 (기본값은 lib/config-specs.ts 의 fallback 과 동일)
-- ─────────────────────────────────────────────────────────────
insert into joop_03_game_config (key, value) values
  ('minigame_move_speed',        '0.85'::jsonb),  -- 좌우 이동 속도(화면폭/초)
  ('minigame_fall_speed',        '0.3'::jsonb),   -- 낙하 시작 속도(화면높이/초)
  ('minigame_fall_ramp',         '0.012'::jsonb), -- 난이도 상승 계수(/초)
  ('minigame_spawn_interval',    '0.85'::jsonb),  -- 물체 생성 간격(초)
  ('minigame_hazard_ratio',      '0.35'::jsonb),  -- 위험물(작동 중 위성) 비율
  ('minigame_lives',             '3'::jsonb),     -- 내구도(허용 충돌 횟수)
  ('minigame_duration_seconds',  '60'::jsonb)     -- 훈련 제한 시간(초)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 3. 테스트 기간 난이도 완화 — "쉽게 발사까지 가보기"
--    레벨 = 1 + floor(XP/100), XP = 수거수 × xp_per_debris.
--    8 → 25 로 올리면 4개만 받아내도 Lv.2, 8개면 Lv.3 이 된다.
--    ⚠️ 정식 운영 전에 되돌려야 하는 값이다(관리자 콘솔에서 조정 가능).
-- ─────────────────────────────────────────────────────────────
update joop_03_game_config
   set value = '25'::jsonb, updated_at = now()
 where key = 'minigame_xp_per_debris' and value::numeric < 25;

-- 새 발사체 등록 시 채워지는 필요 레벨 기본값도 1로 낮춘다.
update joop_03_game_config
   set value = '1'::jsonb, updated_at = now()
 where key = 'launch_required_level' and value::numeric > 1;

-- 이미 시드된 발사체의 자격 레벨(2~4)을 최대 2로 눌러 준다.
-- 게이팅 UI(필요 레벨 미달 표시)는 계속 확인할 수 있게 전부 1로 만들지는 않는다.
update joop_03_launch_vehicles
   set required_level = least(required_level, 2)
 where status = 'scheduled' and required_level > 2;
