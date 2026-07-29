import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

// 주간 랭킹 한 줄 (joop_03_rankings_weekly 뷰).
export type RankingRow = {
  joopId: string;
  name: string;
  color: string;
  totalCollected: number;
  rank: number;
  prevRank: number; // 7일 이전 누적 기준 순위 → 등락 = prevRank - rank
  collectedInWeek: number; // 최근 1주 수거량 (스파크라인/보조 표시)
};

type WeeklyRow = {
  joop_id: string;
  name: string;
  color: string;
  total_collected: number;
  rank: number;
  prev_rank: number;
  collected_in_week: number;
};

// 뷰 select 컬럼(공통)
const COLS = "joop_id,name,color,total_collected,rank,prev_rank,collected_in_week";

/** anon/admin 어느 클라이언트든 주입 가능(뷰는 anon select 허용 + security_invoker). */
type RankingClient = SupabaseClient;

/**
 * 비캐시 원본 — 서버 액션처럼 "쓰기 전후 재조회"가 필요한 곳에서 클라이언트를
 * 주입해 호출한다. cached 버전(getRankings)은 react.cache 라 같은 요청에서
 * 두 번 부르면 첫 값이 돌아온다(before==after 함정).
 */
export async function fetchRankings(sb: RankingClient, limit = 20): Promise<RankingRow[]> {
  const { data, error } = await sb
    .from("joop_03_rankings_weekly")
    .select(COLS)
    .order("rank", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as WeeklyRow[]).map(toRow);
}

export async function fetchMyRanking(sb: RankingClient, joopId: string): Promise<RankingRow | null> {
  const { data, error } = await sb
    .from("joop_03_rankings_weekly")
    .select(COLS)
    .eq("joop_id", joopId)
    .maybeSingle();
  if (error) throw error;
  return data ? toRow(data as WeeklyRow) : null;
}

/** 상위 랭킹을 순위 오름차순으로 조회. */
export const getRankings = cache(async (limit = 20): Promise<RankingRow[]> => {
  return fetchRankings(createServerClient(), limit);
});

function toRow(r: WeeklyRow): RankingRow {
  return {
    joopId: r.joop_id,
    name: r.name,
    color: r.color,
    totalCollected: Number(r.total_collected),
    rank: Number(r.rank),
    prevRank: Number(r.prev_rank),
    collectedInWeek: Number(r.collected_in_week),
  };
}

/**
 * 내 줍스의 현재 순위 — 뷰가 전체 줍스를 담고 joop_id 로 필터 가능하므로
 * 마이그레이션 없이 한 행만 뽑는다(뷰는 security_invoker + anon 읽기 허용).
 */
export const getMyRanking = cache(async (joopId: string): Promise<RankingRow | null> => {
  return fetchMyRanking(createServerClient(), joopId);
});
