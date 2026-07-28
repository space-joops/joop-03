"use server";

import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type SetupState = { error?: string } | null;

const ALLOWED_COLORS = ["#35e07a", "#ffb23e", "#38e0f0", "#ff5c77", "#c8ff00", "#ff00d4"];

// 이름(유니크)·색 설정 + 줍스 분양(지상 상태로 생성).
export async function completeSetup(
  lang: string,
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "");

  if (name.length < 2 || name.length > 20) return { error: "name_len" };
  if (!ALLOWED_COLORS.includes(color)) return { error: "color" };

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/onboarding`);

  const admin = createAdminClient();

  // 이름 중복(프로필/줍스 모두 유니크) 확인
  const [{ data: dupProfile }, { data: dupJoop }] = await Promise.all([
    admin.from("joop_03_profiles").select("id").eq("display_name", name).neq("id", user.id).maybeSingle(),
    admin.from("joop_03_joops").select("id").eq("name", name).maybeSingle(),
  ]);
  if (dupProfile || dupJoop) return { error: "name_taken" };

  // 프로필 갱신
  const { error: profErr } = await admin
    .from("joop_03_profiles")
    .update({ display_name: name, color })
    .eq("id", user.id);
  if (profErr) return { error: "name_taken" };

  // 이미 분양된 줍스가 있으면 스킵(재진입 안전)
  const { data: existingJoop } = await admin
    .from("joop_03_joops")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!existingJoop) {
    // 지상(ground) 상태로 분양. 궤도 파라미터는 not-null 이라 기본값 부여(지상은 미사용).
    const { error: joopErr } = await admin.from("joop_03_joops").insert({
      owner_id: user.id,
      name,
      color,
      orbit_radius: 1.1,
      orbit_inclination: 45,
      orbit_raan: 0,
      orbit_phase0: 0,
      orbit_angular_velocity: 0.001,
      status: "ground",
      level: 1,
      total_collected: 0,
    });
    if (joopErr) return { error: "name_taken" };
  }

  redirect(`/${lang}?setup=done`);
}
