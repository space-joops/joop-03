"use server";

import { createSessionClient } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getArcadeMaxPerRun, getArcadeShadowXpCost } from "@/lib/game-config";
import { getMyOrbitState } from "@/lib/space";
import { levelFromXp } from "@/lib/minigame";

export type ShadowEntryResult =
  | { ok: true; charged: number; xpLeft: number }
  | { ok: false; error: "auth" | "no_joop" | "not_orbit" | "insufficient_xp" | "save" };

// 음영(교신 불가) 중 아케이드 진입 — 초기 개발 단계라 XP 를 소량 지불하면 열어 준다.
// 수신 지역이면 아무것도 청구하지 않고 통과시킨다(호출자가 상태를 착각해도 안전).
//
// ⚠️ 음영 여부는 **서버에서 다시 판정**한다. 클라이언트가 "지금 수신 중"이라고 주장해도
//    무료 통과되지 않는다. XP 감산은 `.eq("xp", 현재값)` 조건부 갱신 + 갱신 행 확인으로
//    동시 요청에서 이중 차감되지 않게 한다(PostgREST 는 조건 불일치가 오류가 아니라 0행).
export async function payShadowEntry(): Promise<ShadowEntryResult> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const [state, cost] = await Promise.all([getMyOrbitState(), getArcadeShadowXpCost()]);
  if (!state) return { ok: false, error: "not_orbit" };

  const admin = createAdminClient();
  const { data: joop } = await admin
    .from("joop_03_joops")
    .select("id,status,xp")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!joop) return { ok: false, error: "no_joop" };
  if (joop.status !== "orbit") return { ok: false, error: "not_orbit" };

  // 수신 지역이거나 비용이 0이면 무료
  if (!state.inShadow || cost <= 0) {
    return { ok: true, charged: 0, xpLeft: Number(joop.xp) };
  }

  let current = Number(joop.xp);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (current < cost) return { ok: false, error: "insufficient_xp" };
    const next = current - cost;
    const { data: updated, error } = await admin
      .from("joop_03_joops")
      // level 은 xp 의 캐시라 같이 갱신해야 발사 자격 표시와 어긋나지 않는다
      .update({ xp: next, level: levelFromXp(next) })
      .eq("id", joop.id)
      .eq("xp", current)
      .select("xp");
    if (error) return { ok: false, error: "save" };
    if (updated && updated.length > 0) return { ok: true, charged: cost, xpLeft: next };

    const { data: fresh } = await admin
      .from("joop_03_joops")
      .select("xp")
      .eq("id", joop.id)
      .maybeSingle();
    if (!fresh) return { ok: false, error: "save" };
    current = Number(fresh.xp);
  }
  return { ok: false, error: "save" };
}

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
