-- 롤백: 20260727150000_joop_03_arcade.sql
-- ⚠️ 공유 jd-04. joop_03_ 객체만. 스키마 변경이 없었으므로 config 키 삭제뿐.

delete from joop_03_game_config where key like 'arcade_%';
