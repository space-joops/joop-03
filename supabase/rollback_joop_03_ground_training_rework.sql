-- 롤백: 20260727120000_joop_03_ground_training_rework.sql
-- ⚠️ 공유 jd-04. joop_03_ 객체만.
--
-- 스키마 변경은 없고 운영 파라미터(joop_03_game_config)와 발사체 자격 레벨만 되돌린다.
-- 발사체 required_level 은 원래 값(2~4)을 알 수 없으므로 시드 값으로 복구한다.

-- 1. 새 지상 훈련 키 제거
delete from joop_03_game_config
 where key in (
   'minigame_move_speed',
   'minigame_fall_speed',
   'minigame_fall_ramp',
   'minigame_spawn_interval',
   'minigame_hazard_ratio',
   'minigame_lives',
   'minigame_duration_seconds'
 );

-- 2. 관성·분사 물리 키 복구
insert into joop_03_game_config (key, value) values
  ('minigame_thrust',    '0.35'::jsonb),
  ('minigame_max_speed', '6'::jsonb),
  ('minigame_fuel',      '100'::jsonb),
  ('minigame_friction',  '0'::jsonb)
on conflict (key) do nothing;

-- 3. 테스트용 난이도 완화 되돌리기
update joop_03_game_config set value = '8'::jsonb, updated_at = now()
 where key = 'minigame_xp_per_debris';
update joop_03_game_config set value = '3'::jsonb, updated_at = now()
 where key = 'launch_required_level';

-- 4. 시드 발사체 자격 레벨 복구
update joop_03_launch_vehicles set required_level = 3 where name = 'Falcon 9';
update joop_03_launch_vehicles set required_level = 2 where name = 'Electron';
update joop_03_launch_vehicles set required_level = 4 where name = 'Ariane 6';
update joop_03_launch_vehicles set required_level = 3 where name = 'Long March 5';
update joop_03_launch_vehicles set required_level = 2 where name = 'Soyuz-2';
