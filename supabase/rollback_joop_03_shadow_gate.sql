-- 롤백: 20260727170000_joop_03_shadow_gate.sql
-- ⚠️ 공유 jd-04. 스키마 변경이 없었으므로 config 키 삭제뿐.
-- 지우면 코드 폴백(orbit_game_speed 30 · shadow_fraction 0.35 · arcade_shadow_xp_cost 20)이 쓰인다.

delete from joop_03_game_config
 where key in ('orbit_game_speed', 'shadow_fraction', 'arcade_shadow_xp_cost');
