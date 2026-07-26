import { cache } from "react";
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

/** 상위 랭킹을 순위 오름차순으로 조회. */
export const getRankings = cache(async (limit = 20): Promise<RankingRow[]> => {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("joop_03_rankings_weekly")
    .select("joop_id,name,color,total_collected,rank,prev_rank,collected_in_week")
    .order("rank", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as WeeklyRow[]).map((r) => ({
    joopId: r.joop_id,
    name: r.name,
    color: r.color,
    totalCollected: Number(r.total_collected),
    rank: Number(r.rank),
    prevRank: Number(r.prev_rank),
    collectedInWeek: Number(r.collected_in_week),
  }));
});
