"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { setAdminCookie, clearAdminCookie, verifyPassword } from "@/lib/admin/session";
import { isLoginLocked, recordLoginFailure, clearLoginFailures } from "@/lib/admin/rate-limit";

export type AdminLoginState = { error?: string } | null;

/** 성공·실패 모두 같은 지연을 준다. 실패에만 걸면 그 자체가 타이밍 오라클이 된다. */
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function loginAdmin(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const password = String(formData.get("password") ?? "");
  const key = await clientKey();

  if (isLoginLocked(key)) {
    await delay(600);
    return { error: "locked" };
  }
  if (!password) {
    await delay(600);
    return { error: "empty" };
  }

  const result = verifyPassword(password);
  await delay(600);

  if (result === "config") return { error: "config" };
  if (result === "invalid") {
    recordLoginFailure(key);
    return { error: "invalid" };
  }

  if (!(await setAdminCookie())) return { error: "config" };
  clearLoginFailures(key);

  // ⚠️ redirect() 는 예외를 던지므로 try 블록 밖에서 호출한다.
  redirect("/admin");
}

export async function logoutAdmin(): Promise<void> {
  await clearAdminCookie();
  redirect("/admin/login");
}
