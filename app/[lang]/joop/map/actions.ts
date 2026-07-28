"use server";

import { createSessionClient } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReturnResult = { ok: true } | { ok: false; error: "auth" | "no_joop" | "not_orbit" | "save" };

// 지구 복귀 — 궤도의 줍스를 지상으로 되돌려 발사 루프를 처음부터 다시 돌 수 있게 한다.
//
// 유지: total_collected(랭킹 근거) · xp · level — 복귀는 손실이 아니다.
// 초기화:
//   - status 'orbit' → 'ground' (check 제약 안의 값이라 마이그레이션 불필요)
//   - 궤도 파라미터 5종 → 분양 시 기본값(not null 이라 NULL 불가, setup 액션과 동일 값)
//   - last_collected_at → null — 지우지 않으면 지상 체류 시간이 다음 발사 직후
//     idle 자동 수거로 소급 정산된다(lib/space.ts 는 null 이면 정산 0)
//   - confirmed 예약 삭제 — 정원을 되돌리고 같은 발사체 재청약(unique 제약)을 풀어 준다.
//     상태 확장('used' 등)은 check 제약 마이그레이션이 필요해 삭제를 택했다.
export async function returnToEarth(): Promise<ReturnResult> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const admin = createAdminClient();
  const { data: joop } = await admin
    .from("joop_03_joops")
    .select("id,status")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!joop) return { ok: false, error: "no_joop" };
  if (joop.status !== "orbit") return { ok: false, error: "not_orbit" };

  // 조건부 전이(.eq status) + 갱신 행 확인 — 동시 요청·정산과의 경쟁에서 안전하게.
  const { data: updated, error } = await admin
    .from("joop_03_joops")
    .update({
      status: "ground",
      orbit_radius: 1.1,
      orbit_inclination: 45,
      orbit_raan: 0,
      orbit_phase0: 0,
      orbit_angular_velocity: 0.001,
      last_collected_at: null,
    })
    .eq("id", joop.id)
    .eq("status", "orbit")
    .select("id");
  if (error || !updated || updated.length === 0) return { ok: false, error: "save" };

  // 소비한 확정 예약 정리 — 실패해도 복귀 자체는 성공으로 둔다(재청약 시도 시 duplicate 로 드러남)
  await admin
    .from("joop_03_launch_bookings")
    .delete()
    .eq("owner_id", user.id)
    .eq("status", "confirmed");

  return { ok: true };
}
