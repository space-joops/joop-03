"use server";

import { createSessionClient } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getArcadeMaxPerRun } from "@/lib/game-config";

export type ArcadeResult =
  | { ok: true; collected: number; totalCollected: number }
  | { ok: false; error: "invalid" | "auth" | "no_joop" | "not_orbit" | "save" };

// 아케이드 결과 저장 — 궤도 단계의 화폐는 XP가 아니라 "수거 조각"이다.
// settleIdleCollection(lib/space.ts)과 같은 규약으로 debris_events + total_collected 를
// 갱신하므로 첫 화면 게이지·랭킹이 바로 움직인다. 인벤토리(EPIC 8)는 후속.
//
// 상한 처리: 지상 훈련은 상한 초과를 통째로 거부해 정상 플레이어가 몰수당할 수 있었다
// (이슈 #36-1). 여기서는 상한으로 **클램핑**해 최소한 상한만큼은 인정한다.
export async function submitArcadeResult(collected: number): Promise<ArcadeResult> {
  const maxPerRun = await getArcadeMaxPerRun();

  const raw = Math.floor(Number(collected));
  if (!Number.isFinite(raw) || raw < 0) return { ok: false, error: "invalid" };
  const n = Math.min(raw, maxPerRun);
  if (n === 0) return { ok: false, error: "invalid" };

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const admin = createAdminClient();
  const { data: joop } = await admin
    .from("joop_03_joops")
    .select("id,status,total_collected")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!joop) return { ok: false, error: "no_joop" };
  // 아케이드는 궤도에서만 성립한다(수신 지역 게임). 지상 줍스의 위조 요청 차단.
  if (joop.status !== "orbit") return { ok: false, error: "not_orbit" };

  const now = new Date().toISOString();
  const { error: evErr } = await admin.from("joop_03_debris_events").insert({
    joop_id: joop.id,
    amount: n,
    occurred_at: now,
  });
  if (evErr) return { ok: false, error: "save" };

  // 낙관적 갱신 — 자동 수거 정산 등과 겹치면(가드 불일치 = 0행 갱신) 새로 읽어 한 번 더 시도.
  // 조건 불일치는 오류가 아니라 0행이므로 .select() 로 실제 갱신 여부를 확인해야 한다.
  let base = Number(joop.total_collected);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: updated, error: upErr } = await admin
      .from("joop_03_joops")
      .update({ total_collected: base + n })
      .eq("id", joop.id)
      .eq("total_collected", base)
      .select("total_collected");
    if (upErr) return { ok: false, error: "save" };
    if (updated && updated.length > 0) {
      return { ok: true, collected: n, totalCollected: base + n };
    }
    const { data: fresh } = await admin
      .from("joop_03_joops")
      .select("total_collected")
      .eq("id", joop.id)
      .maybeSingle();
    if (!fresh) return { ok: false, error: "save" };
    base = Number(fresh.total_collected);
  }
  return { ok: false, error: "save" };
}
