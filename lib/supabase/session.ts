import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 쿠키 기반 세션 클라이언트 (@supabase/ssr). 익명/인증 세션 읽기·쓰기.
// ⚠️ 커스텀 Next.js 16: cookies() 는 async. setAll 은 Server Action/Route Handler
//    에서만 실제로 쿠키를 쓸 수 있고, Server Component 렌더 중에는 예외를 삼킨다.
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component 렌더 중 set 은 무시(미들웨어/액션에서 갱신됨)
          }
        },
      },
    },
  );
}
