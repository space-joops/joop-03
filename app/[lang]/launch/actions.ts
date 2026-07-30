"use server";

import { revalidatePath } from "next/cache";
import { createSessionClient } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { levelFromXp } from "@/lib/minigame";

export type BookingResult =
  | { ok: true; status: "confirmed" | "pending" }
  | {
      ok: false;
      error: "auth" | "no_joop" | "already_booked" | "under_level" | "not_found" | "duplicate" | "save";
    };

// 발사체 청약 + 자동 선별.
// 자격(레벨) 충족 + 정원 내 → confirmed, 정원 초과 → pending, 자격 미달 → 거부.
export async function bookLaunch(lang: string, vehicleId: string): Promise<BookingResult> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const admin = createAdminClient();

  const { data: joop } = await admin
    .from("joop_03_joops")
    .select("id,xp,status")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!joop) return { ok: false, error: "no_joop" };
  // 이미 확정 청약을 보유(queued)했거나 궤도(orbit)면 새 발사체 청약을 막는다 —
  // 이게 없으면 서로 다른 발사체에 중복 confirmed 가 생겨 발사 완료가 영영 안 되는 버그(#29)로 이어진다.
  if (joop.status !== "ground") return { ok: false, error: "already_booked" };

  const { data: vehicle } = await admin
    .from("joop_03_launch_vehicles")
    .select("id,capacity,required_level,status")
    .eq("id", vehicleId)
    .maybeSingle();
  if (!vehicle || vehicle.status !== "scheduled") return { ok: false, error: "not_found" };

  const myLevel = levelFromXp(Number(joop.xp));
  if (myLevel < vehicle.required_level) return { ok: false, error: "under_level" };

  // 이미 청약했는지
  const { data: existing } = await admin
    .from("joop_03_launch_bookings")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (existing) return { ok: false, error: "duplicate" };

  // 정원 대비 확정 수(자동 선별)
  const { count } = await admin
    .from("joop_03_launch_bookings")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", vehicleId)
    .eq("status", "confirmed");

  const status: "confirmed" | "pending" =
    (count ?? 0) < vehicle.capacity ? "confirmed" : "pending";

  const { error } = await admin.from("joop_03_launch_bookings").insert({
    vehicle_id: vehicleId,
    joop_id: joop.id,
    owner_id: user.id,
    status,
  });
  if (error) return { ok: false, error: "save" };

  // 확정 시 줍스 상태를 queued 로
  if (status === "confirmed") {
    await admin.from("joop_03_joops").update({ status: "queued" }).eq("id", joop.id);
  }

  revalidatePath(`/${lang}/launch`);
  return { ok: true, status };
}
