import { requireAdmin } from "@/lib/admin/auth";
import { getInviteCodes } from "@/lib/admin/queries";
import { AdminInvitePanel } from "@/components/admin/invite-panel";
import { mutedTextClass } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminInvitesPage() {
  await requireAdmin();
  const invites = await getInviteCodes();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-mono text-lg font-semibold text-[var(--color-fg)]">초대코드</h1>
        <p className={`mt-1 ${mutedTextClass}`}>
          지금까지는 코드를 SQL 로 직접 넣어야 했습니다. 여기서 발급하고 폐기합니다.
        </p>
      </div>

      <AdminInvitePanel invites={invites} />
    </div>
  );
}
