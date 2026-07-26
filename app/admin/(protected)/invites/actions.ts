"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CODE_PREFIX,
  MAX_BATCH,
  isValidLabel,
  nextInviteCodes,
  randomLabel,
} from "@/lib/admin/invite-codes";

// ⚠️ 이 파일의 모든 액션은 첫 줄에서 requireAdminAction() 을 호출해야 한다.

export type InviteState =
  | { ok: true; codes: string[] }
  | {
      ok: false;
      error: "auth" | "label" | "count" | "email" | "label_full" | "collision" | "save";
    }
  | null;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 라벨 하나로 N개를 발급한다. 코드가 PK 라 동시 발급 시 충돌할 수 있어 한 번 재시도한다. */
async function issueCodes(
  label: string,
  count: number,
  email: string | null,
): Promise<InviteState> {
  const admin = createAdminClient();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: existing, error: readErr } = await admin
      .from("joop_03_invite_codes")
      .select("code")
      .like("code", `${CODE_PREFIX}-${label}-%`);
    if (readErr) return { ok: false, error: "save" };

    const codes = nextInviteCodes(
      label,
      ((existing ?? []) as { code: string }[]).map((r) => r.code),
      count,
    );
    if (!codes) return { ok: false, error: "label_full" };

    const { error } = await admin
      .from("joop_03_invite_codes")
      .insert(codes.map((code) => ({ code, email })));

    if (!error) return { ok: true, codes };
    // 23505 = unique_violation → 다른 요청이 같은 번호를 먼저 가져갔다. 다시 읽고 재시도.
    if (error.code !== "23505") return { ok: false, error: "save" };
  }

  return { ok: false, error: "collision" };
}

export async function issueInviteCodes(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  if (!(await requireAdminAction())) return { ok: false, error: "auth" };

  const label = String(formData.get("label") ?? "").trim().toUpperCase();
  if (!isValidLabel(label)) return { ok: false, error: "label" };

  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  if (rawEmail && !EMAIL_RE.test(rawEmail)) return { ok: false, error: "email" };
  const email = rawEmail || null;

  // 특정인 대상 코드를 여러 개 만드는 건 의미가 없으므로 1개로 고정한다.
  const count = email ? 1 : Number(formData.get("count"));
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) {
    return { ok: false, error: "count" };
  }

  const result = await issueCodes(label, count, email);
  if (result?.ok) {
    revalidatePath("/admin/invites");
    revalidatePath("/admin/waitlist");
    revalidatePath("/admin");
  }
  return result;
}

export type RevokeResult =
  | { ok: true }
  | { ok: false; error: "auth" | "not_found" | "already_used" | "save" };

export async function revokeInviteCode(code: string): Promise<RevokeResult> {
  if (!(await requireAdminAction())) return { ok: false, error: "auth" };

  const normalized = String(code ?? "").trim().toUpperCase();
  if (!normalized) return { ok: false, error: "not_found" };

  const admin = createAdminClient();

  // 조건부 UPDATE — 관리자가 폐기를 누르는 순간 사용자가 그 코드를 소진 중일 수 있다.
  // 먼저 이긴 쪽이 확정되고 진 쪽은 명확한 에러를 받는다(redeemInvite 와 같은 패턴).
  const { data, error } = await admin
    .from("joop_03_invite_codes")
    .update({ status: "revoked" })
    .eq("code", normalized)
    .eq("status", "active")
    .select("code");
  if (error) return { ok: false, error: "save" };

  if (!data || data.length === 0) {
    const { data: row } = await admin
      .from("joop_03_invite_codes")
      .select("status")
      .eq("code", normalized)
      .maybeSingle();
    if (!row) return { ok: false, error: "not_found" };
    return { ok: false, error: row.status === "used" ? "already_used" : "not_found" };
  }

  revalidatePath("/admin/invites");
  revalidatePath("/admin/waitlist");
  revalidatePath("/admin");
  return { ok: true };
}

export type WaitlistInviteResult =
  | { ok: true; code: string }
  | { ok: false; error: "auth" | "email" | "not_in_waitlist" | "already_issued" | "save" };

/** 대기리스트 항목에서 바로 초대코드를 발급한다. 라벨은 WAIT 고정이라 출처가 코드에 남는다. */
export async function issueInviteForWaitlist(email: string): Promise<WaitlistInviteResult> {
  if (!(await requireAdminAction())) return { ok: false, error: "auth" };

  const normalized = String(email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) return { ok: false, error: "email" };

  const admin = createAdminClient();

  // 임의 이메일로 코드를 찍어내지 못하도록 실제 대기리스트에 있는지 확인한다.
  const { data: entry } = await admin
    .from("joop_03_waitlist")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (!entry) return { ok: false, error: "not_in_waitlist" };

  const { data: active } = await admin
    .from("joop_03_invite_codes")
    .select("code")
    .eq("email", normalized)
    .eq("status", "active")
    .maybeSingle();
  if (active) return { ok: false, error: "already_issued" };

  // WAIT 라벨은 99개까지만 채울 수 있다. 다 차면 랜덤 라벨로 넘어간다.
  let result = await issueCodes("WAIT", 1, normalized);
  if (result && !result.ok && result.error === "label_full") {
    result = await issueCodes(randomLabel(), 1, normalized);
  }
  if (!result?.ok) return { ok: false, error: "save" };

  revalidatePath("/admin/waitlist");
  revalidatePath("/admin/invites");
  revalidatePath("/admin");
  return { ok: true, code: result.codes[0] };
}
