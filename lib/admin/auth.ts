import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readAdminCookie, type AdminSession } from "@/lib/admin/session";

// 관리자 가드. 3층으로 쓴다.
//
//  1. app/admin/(protected)/layout.tsx  — 최초 진입 차단
//  2. 각 protected page.tsx              — 레이아웃은 클라이언트 네비게이션 때 재실행되지
//                                          않으므로(layout.md "Layouts do not rerender")
//                                          레이아웃만으로는 세션 만료를 못 잡는다
//  3. 모든 mutation Server Action        — ★ 보안상 유일하게 필수인 층.
//                                          Server Action 은 렌더 게이팅을 전혀 거치지 않고
//                                          POST 로 직접 호출될 수 있다(proxy.md 참조)

export type { AdminSession };

/** 현재 요청의 관리자 세션. 없음/만료/위조/설정누락이면 null. 예외를 던지지 않는다. */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  return readAdminCookie();
});

/** 페이지·레이아웃용. 세션이 없으면 로그인 화면으로 보내고 반환하지 않는다. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

/**
 * Server Action 용. redirect() 를 던지지 않고 null 을 돌려주므로 액션이
 * { ok: false, error: "auth" } 를 반환할 수 있다(이 코드베이스의 액션 규약).
 */
export async function requireAdminAction(): Promise<AdminSession | null> {
  return getAdminSession();
}
