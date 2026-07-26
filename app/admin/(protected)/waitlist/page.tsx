import { requireAdmin } from "@/lib/admin/auth";
import { getWaitlistWithInvites } from "@/lib/admin/queries";
import { AdminWaitlistList } from "@/components/admin/waitlist-list";
import { mutedTextClass, panelClass, panelStyle } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const LIMIT = 200;

export default async function AdminWaitlistPage() {
  await requireAdmin();
  const entries = await getWaitlistWithInvites(LIMIT);

  const withoutInvite = entries.filter((e) => !e.invite).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-mono text-lg font-semibold text-[var(--color-fg)]">대기리스트</h1>
        <p className={`mt-1 ${mutedTextClass}`}>
          초대 코드 없이 이메일만 남긴 사람들입니다. 총 {entries.length}명 · 코드 미발급{" "}
          {withoutInvite}명.
          {entries.length === LIMIT && ` 최근 ${LIMIT}건만 표시합니다.`}
        </p>
      </div>

      <div className={panelClass} style={panelStyle}>
        <AdminWaitlistList entries={entries} />
      </div>
    </div>
  );
}
