import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/auth";
import { AdminLoginForm } from "@/components/admin/login-form";
import { panelClass, panelStyle, mutedTextClass } from "@/components/admin/ui";

// 가드 밖(라우트 그룹 (protected) 바깥)에 있어야 하는 유일한 관리자 화면.
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");

  return (
    <main
      className="flex flex-1 items-center justify-center px-5 py-16"
      style={{ background: "var(--color-bg)" }}
    >
      <div className={`w-full max-w-sm ${panelClass}`} style={panelStyle}>
        <h1 className="font-mono text-sm font-semibold uppercase tracking-widest text-[var(--color-fg)]">
          줍스 관리자 콘솔
        </h1>
        <p className={`mt-1 mb-5 ${mutedTextClass}`}>운영자 전용 화면입니다.</p>
        <AdminLoginForm />
      </div>
    </main>
  );
}
