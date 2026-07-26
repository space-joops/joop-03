-- 롤백: 20260726160926_joop_03_launch.sql
-- ⚠️ 공유 jd-04. joop_03_ 객체만.

drop table if exists joop_03_launch_bookings;
drop table if exists joop_03_launch_vehicles;
alter table joop_03_joops drop column if exists xp;
-- game_config 의 minigame_*/launch_* 키는 남겨도 무해(운영 파라미터). 필요 시:
-- delete from joop_03_game_config where key like 'minigame_%' or key = 'launch_required_level';
