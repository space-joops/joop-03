import "server-only";
import { createClient } from "@supabase/supabase-js";

// service_role 관리자 클라이언트 — RLS 우회. 서버에서만(초대코드 검증·소진, 대기리스트 등록).
// ⚠️ SUPABASE_SERVICE_ROLE_KEY 는 절대 클라이언트에 노출 금지.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
