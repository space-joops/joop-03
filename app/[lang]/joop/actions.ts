"use server";

import { createSessionClient } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { levelFromXp } from "@/lib/minigame";
import { getMinigameConfig, getMaxDebrisPerRun } from "@/lib/game-config";

export type MinigameResult =
  | { ok: true; xpGained: number; level: number; xp: number }
  | { ok: false; error: string };

// 미니게임 결과 저장: 먹은 개수만 받아 서버에서 xp 계산 → 누적 → level 갱신.
// XP 단가와 치팅 상한은 joop_03_game_config 에서 읽는다(관리자 콘솔에서 조정, EPIC 10).
export async function submitMinigameResult(collected: number): Promise<MinigameResult> {
  const [cfg, maxPerRun] = await Promise.all([getMinigameConfig(), getMaxDebrisPerRun()]);

  const n = Math.floor(Number(collected));
  if (!Number.isFinite(n) || n < 0 || n > maxPerRun) {
    return { ok: false, error: "invalid" };
  }

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const admin = createAdminClient();
  const { data: joop } = await admin
    .from("joop_03_joops")
    .select("id,xp")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!joop) return { ok: false, error: "no_joop" };

  const xpGained = n * cfg.xpPerDebris;
  const newXp = Number(joop.xp) + xpGained;
  const newLevel = levelFromXp(newXp);

  const { error } = await admin
    .from("joop_03_joops")
    .update({ xp: newXp, level: newLevel })
    .eq("id", joop.id);
  if (error) return { ok: false, error: "save" };

  return { ok: true, xpGained, level: newLevel, xp: newXp };
}
