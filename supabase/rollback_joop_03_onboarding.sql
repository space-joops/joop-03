-- 롤백: 20260726153146_joop_03_onboarding.sql
-- ⚠️ 공유 jd-04. joop_03_ 객체만 제거. 다른 프로젝트 객체 금지.

drop policy if exists joop_03_joops_owner_insert on joop_03_joops;
drop policy if exists joop_03_joops_owner_update on joop_03_joops;

drop table if exists joop_03_waitlist;
drop table if exists joop_03_invite_codes;
drop table if exists joop_03_profiles;
