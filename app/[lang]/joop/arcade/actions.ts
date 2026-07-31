"use server";

import { createSessionClient } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getArcadeMaxPerRun, getArcadeShadowXpCost } from "@/lib/game-config";
import { getMyOrbitState } from "@/lib/space";
import { levelFromXp } from "@joop/arcade-engine";
import { fetchMyRanking, fetchRankings, type RankingRow } from "@/lib/rankings";
import { adSatelliteById } from "@joop/arcade-engine";
import { CODE_PREFIX, nextInviteCodes, randomLabel } from "@/lib/admin/invite-codes";

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

/** 이번 판 저장이 만든 랭킹 변화 — 교신 종료 화면 연출용 */
export type ArcadeRankingDelta = {
  /** 갱신 전 내 순위(뷰에 없었으면 null = 첫 진입) */
  rankBefore: number | null;
  rankAfter: number | null;
  /** 갱신 후 상위 5 */
  top: RankingRow[];
  /** 갱신 후 내 행 */
  me: RankingRow | null;
};

export type ArcadeResult =
  | { ok: true; collected: number; totalCollected: number; ranking: ArcadeRankingDelta | null }
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

  // 이번 판이 만든 등락을 보이려면 갱신 **전** 순위가 필요하다(뷰의 prev_rank 는
  // "7일 전 기준"이라 방금 저장으로는 움직이지 않는다).
  // ⚠️ cached getMyRanking 은 쓰지 않는다 — react.cache 라 같은 요청에서 갱신 후
  //    다시 불러도 이 값이 그대로 돌아온다(before==after 함정).
  const rankBefore = await fetchMyRanking(admin, joop.id)
    .then((r) => r?.rank ?? null)
    .catch(() => null);

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
      // 갱신 후 랭킹 — 일반 뷰라 즉시 반영된다. 조회 실패는 null 폴백:
      // 랭킹은 연출이지 저장 성공의 조건이 아니다.
      let ranking: ArcadeRankingDelta | null = null;
      try {
        const [top, me] = await Promise.all([
          fetchRankings(admin, 5),
          fetchMyRanking(admin, joop.id),
        ]);
        ranking = { rankBefore, rankAfter: me?.rank ?? null, top, me };
      } catch {
        ranking = null;
      }
      return { ok: true, collected: n, totalCollected: base + n, ranking };
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

export type DockRewardResult =
  | { ok: true; code: string; isNew: boolean }
  | { ok: false; error: "auth" | "invalid" | "save" };

// 광고 위성 도킹 보상 — **실제 초대코드**를 joop_03_invite_codes 에 발급한다
// (FR-9.1 부분 구현, 마이그레이션 0: 미사용이던 issuer_id 컬럼을 여기서 처음 쓴다).
//
// 멱등: 같은 사용자가 같은 브랜드에 다시 도킹하면 새 코드를 만들지 않고 기존 코드를
// 돌려준다(브랜드당 1코드). 라벨 일련번호(NN≤99)가 소진되면 랜덤 라벨로 폴백
// (waitlist 발급 액션과 같은 관행).
export async function claimAdDockReward(brandId: string): Promise<DockRewardResult> {
  const sat = adSatelliteById(String(brandId));
  if (!sat) return { ok: false, error: "invalid" };

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const admin = createAdminClient();
  const prefix = `${CODE_PREFIX}-${sat.codeLabel}-`;

  // 멱등 조회 — 이 사용자가 이 브랜드로 이미 발급받은 코드
  const { data: mine, error: mineErr } = await admin
    .from("joop_03_invite_codes")
    .select("code")
    .eq("issuer_id", user.id)
    .like("code", `${prefix}%`)
    .limit(1);
  if (mineErr) return { ok: false, error: "save" };
  if (mine && mine.length > 0) return { ok: true, code: mine[0].code as string, isNew: false };

  // 발급 — PK 충돌(동시 발급) 시 새 일련번호로 1회 재시도
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: existing, error: exErr } = await admin
      .from("joop_03_invite_codes")
      .select("code")
      .like("code", `${prefix}%`);
    if (exErr) return { ok: false, error: "save" };

    let codes = nextInviteCodes(
      sat.codeLabel,
      (existing ?? []).map((r) => r.code as string),
      1,
    );
    if (!codes) {
      // 브랜드 라벨 소진(NN>99) — 랜덤 라벨로 폴백. 브랜드 연관은 issuer 기록으로만 남는다.
      codes = [`${CODE_PREFIX}-${randomLabel()}-01`];
    }

    const { error: insErr } = await admin.from("joop_03_invite_codes").insert({
      code: codes[0],
      issuer_id: user.id,
      status: "active",
    });
    if (!insErr) return { ok: true, code: codes[0], isNew: true };
    if (insErr.code !== "23505") return { ok: false, error: "save" };
  }
  return { ok: false, error: "save" };
}
