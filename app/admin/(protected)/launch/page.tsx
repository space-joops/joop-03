import { requireAdmin } from "@/lib/admin/auth";
import { getVehiclesForAdmin } from "@/lib/admin/queries";
import { getDefaultRequiredLevel } from "@/lib/game-config";
import { AdminVehicleList } from "@/components/admin/vehicle-list";
import { AdminVehicleForm } from "@/components/admin/vehicle-form";
import { mutedTextClass, panelClass, panelStyle } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminLaunchPage() {
  await requireAdmin();

  const [vehicles, defaultRequiredLevel] = await Promise.all([
    getVehiclesForAdmin(),
    getDefaultRequiredLevel(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-mono text-lg font-semibold text-[var(--color-fg)]">발사체</h1>
        <p className={`mt-1 ${mutedTextClass}`}>
          발사 일정을 관리하고, 이름을 눌러 탑승 대상을 선별합니다(FR-10.3 / FR-4.2).
        </p>
      </div>

      <details className={panelClass} style={panelStyle}>
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          새 발사체 등록
        </summary>
        <div className="mt-4">
          <AdminVehicleForm defaultRequiredLevel={defaultRequiredLevel} />
        </div>
      </details>

      <div className={panelClass} style={panelStyle}>
        <AdminVehicleList vehicles={vehicles} defaultRequiredLevel={defaultRequiredLevel} />
      </div>
    </div>
  );
}
