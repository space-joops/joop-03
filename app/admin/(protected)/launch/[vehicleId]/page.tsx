import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getVehicleRoster } from "@/lib/admin/queries";
import { AdminRoster } from "@/components/admin/roster";
import {
  badgeClass,
  cellBorderStyle,
  formatDateTime,
  mutedTextClass,
  panelClass,
  panelStyle,
  statusStyle,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminVehicleRosterPage({
  params,
}: PageProps<"/admin/launch/[vehicleId]">) {
  await requireAdmin();

  const { vehicleId } = await params;
  const data = await getVehicleRoster(vehicleId);
  if (!data) notFound();

  const { vehicle, roster } = data;
  const fillPercent = Math.min(100, (vehicle.confirmedCount / Math.max(1, vehicle.capacity)) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/launch" className={`${mutedTextClass} underline`}>
          ← 발사체 목록
        </Link>
        <h1 className="mt-2 font-mono text-lg font-semibold text-[var(--color-fg)]">
          {vehicle.name} 탑승 선별
        </h1>
        <p className={`mt-1 ${mutedTextClass}`}>
          {vehicle.provider} · {vehicle.site} · {formatDateTime(vehicle.launchAt)} · 필요 Lv.
          {vehicle.requiredLevel}
        </p>
      </div>

      <div className={panelClass} style={panelStyle}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={badgeClass} style={statusStyle(vehicle.status === "scheduled" ? "ok" : "idle")}>
            {vehicle.status === "scheduled"
              ? "예정"
              : vehicle.status === "launched"
                ? "발사됨"
                : "취소됨"}
          </span>
          <span className="font-mono text-sm text-[var(--color-fg)]">
            확정 {vehicle.confirmedCount} / 정원 {vehicle.capacity}
          </span>
          <span className={mutedTextClass}>
            대기 {vehicle.pendingCount} · 거부 {vehicle.rejectedCount}
          </span>
        </div>

        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full"
          style={{ background: "var(--color-neutral-700)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${fillPercent}%`,
              background: vehicle.overCapacity ? "var(--color-danger)" : "var(--color-primary)",
              boxShadow: vehicle.overCapacity ? "var(--glow-danger)" : "var(--glow-primary)",
            }}
          />
        </div>

        {vehicle.overCapacity && (
          <p className="mt-3 font-mono text-xs text-[var(--color-danger)]">
            확정 인원이 정원을 넘었습니다. 확정 취소 또는 거부로 조정하세요.
          </p>
        )}
        {vehicle.status !== "scheduled" && (
          <p className={`mt-3 ${mutedTextClass}`}>
            예정 상태가 아니라 선별할 수 없습니다. 기록 열람만 가능합니다.
          </p>
        )}
      </div>

      <div className={panelClass} style={{ ...panelStyle, ...cellBorderStyle }}>
        <AdminRoster vehicle={vehicle} roster={roster} />
      </div>
    </div>
  );
}
