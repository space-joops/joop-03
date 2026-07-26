"use server";

import { createSessionClient } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type LaunchResult = { ok: true } | { ok: false; error: string };

// 발사 완료: queued(확정 청약 보유) 줍스를 궤도로 올린다.
// status='orbit' + 궤도 파라미터 부여 + last_collected_at=now → 첫 화면 궤도/랭킹에 등장.
export async function completeLaunch(): Promise<LaunchResult> {
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

  // 이미 궤도면 성공 취급(재진입 안전)
  if (joop.status === "orbit") return { ok: true };
  if (joop.status !== "queued") return { ok: false, error: "not_ready" };

  // 확정 청약 보유 확인
  const { data: booking } = await admin
    .from("joop_03_launch_bookings")
    .select("id")
    .eq("owner_id", user.id)
    .eq("status", "confirmed")
    .maybeSingle();
  if (!booking) return { ok: false, error: "no_booking" };

  // 궤도 파라미터 생성(게임용 단순화, 서버에서 난수 허용)
  const orbit = {
    orbit_radius: 1.05 + Math.random() * 0.28, // 1.05 ~ 1.33
    orbit_inclination: 20 + Math.random() * 78, // 20 ~ 98도
    orbit_raan: Math.random() * 360,
    orbit_phase0: Math.random() * Math.PI * 2,
    orbit_angular_velocity: 0.0008 + Math.random() * 0.0009,
  };

  const { error } = await admin
    .from("joop_03_joops")
    .update({
      status: "orbit",
      ...orbit,
      last_collected_at: new Date().toISOString(),
    })
    .eq("id", joop.id)
    .eq("status", "queued"); // 조건부(경쟁 방지)
  if (error) return { ok: false, error: "save" };

  return { ok: true };
}
