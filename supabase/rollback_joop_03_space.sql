-- 롤백: 20260726181452_joop_03_space.sql
-- ⚠️ 공유 jd-04. joop_03_ 만.
alter table joop_03_joops drop column if exists last_collected_at;
-- config 키는 남겨도 무해. 필요 시:
-- delete from joop_03_game_config where key in ('idle_collect_rate','idle_collect_cap_hours','launch_countdown_seconds');
