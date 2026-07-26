import { requireAdmin } from "@/lib/admin/auth";
import { AdminNav } from "@/components/admin/nav";

// 가드 레이아웃. <html>/<body> 는 app/admin/layout.tsx(루트)가 렌더하므로 여기선 감싸기만 한다.
// 라우트 그룹이라 URL 에는 (protected) 가 나타나지 않는다 → 이 아래 page.tsx 가 곧 /admin.
//
// ⚠️ 레이아웃은 클라이언트 네비게이션 때 재실행되지 않는다. 그래서 각 page.tsx 도
//    첫 줄에서 requireAdmin() 을 호출하고, 모든 mutation 액션은 requireAdminAction() 을 부른다.
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--color-bg)" }}>
      <AdminNav />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-6">{children}</main>
    </div>
  );
}
