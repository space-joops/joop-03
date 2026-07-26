import { createClient } from "@supabase/supabase-js";

// M1: 공개 읽기 전용 anon 클라이언트.
// 첫 화면 데이터는 RLS로 anon SELECT가 허용된 공개 데이터라 쿠키 세션이 필요 없다.
// (로그인 세션/@supabase/ssr 은 M2 인증에서 도입 — docs/architecture/adr/0004-auth-invite.md)
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase 환경변수가 없습니다. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 확인하세요.",
    );
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
