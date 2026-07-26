-- 롤백: 20260726142039_joop_03_first_screen.sql 되돌리기
-- ⚠️ 공유 jd-04 프로젝트. joop_03_ 접두사 객체만 제거한다(다른 프로젝트 객체 금지).
-- 수동 실행용(supabase 마이그레이션은 자동 down을 지원하지 않음).

drop view  if exists joop_03_rankings_weekly;
drop table if exists joop_03_debris_events;   -- joops 참조 → 먼저
drop table if exists joop_03_joops;
drop table if exists joop_03_game_config;
