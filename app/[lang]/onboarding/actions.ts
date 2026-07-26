"use server";

import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type OnboardingState = { error?: string } | null;

// 초대 코드로 시작: 코드 검증 → 익명 세션 생성 → 코드 소진 → 프로필 생성 → 설정 단계로.
export async function redeemInvite(
  lang: string,
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) return { error: "empty" };

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("joop_03_invite_codes")
    .select("code,status")
    .eq("code", code)
    .maybeSingle();

  if (!invite || invite.status !== "active") return { error: "invalid" };

  // 익명 세션 (auth.users 생성 + 쿠키)
  const supabase = await createSessionClient();
  const { data: auth, error: authErr } = await supabase.auth.signInAnonymously();
  if (authErr || !auth.user) return { error: "session" };
  const uid = auth.user.id;

  // 코드 소진(경쟁 조건 방지: status=active 조건부 update)
  const { data: used } = await admin
    .from("joop_03_invite_codes")
    .update({ status: "used", redeemed_by: uid, redeemed_at: new Date().toISOString() })
    .eq("code", code)
    .eq("status", "active")
    .select("code");

  if (!used || used.length === 0) return { error: "invalid" };

  await admin.from("joop_03_profiles").upsert({ id: uid }, { onConflict: "id" });

  // ② 분양 연출(보급 카트리지 부팅)로. 설정(③)은 그 다음 단계.
  redirect(`/${lang}/onboarding/boot`);
}

// 초대 코드가 없는 사용자: 이메일 대기리스트 등록.
export async function joinWaitlist(
  _lang: string,
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "email" };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("joop_03_waitlist")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!existing) {
    const { error } = await admin.from("joop_03_waitlist").insert({ email });
    if (error) return { error: "waitlist" };
  }

  return { error: "joined" }; // 성공 신호(폼에서 안내 메시지로 처리)
}
