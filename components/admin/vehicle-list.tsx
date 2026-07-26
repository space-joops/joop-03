"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setVehicleStatus } from "@/app/admin/(protected)/launch/actions";
import type { AdminVehicle, VehicleStatus } from "@/lib/admin/queries";
import { AdminVehicleForm } from "@/components/admin/vehicle-form";
import {
  badgeClass,
  btnGhostClass,
  btnGhostStyle,
  btnDangerStyle,
  cellBorderStyle,
  errorTextClass,
  formatDateTime,
  mutedTextClass,
  statusStyle,
  tableClass,
  tdClass,
  thClass,
} from "@/components/admin/ui";

const STATUS_LABEL: Record<VehicleStatus, string> = {
  scheduled: "예정",
  launched: "발사됨",
  cancelled: "취소됨",
};

const STATUS_TONE: Record<VehicleStatus, "ok" | "wait" | "bad" | "idle"> = {
  scheduled: "ok",
  launched: "idle",
  cancelled: "bad",
};

const ERRORS: Record<string, string> = {
  auth: "권한이 없습니다. 다시 로그인하세요",
  not_found: "발사체를 찾을 수 없습니다",
  invalid_transition: "발사된 발사체는 상태를 되돌릴 수 없습니다",
  save: "저장에 실패했습니다",
};

export function AdminVehicleList({
  vehicles,
  defaultRequiredLevel,
}: {
  vehicles: AdminVehicle[];
  defaultRequiredLevel: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const changeStatus = (v: AdminVehicle, next: VehicleStatus) => {
    const message =
      next === "cancelled"
        ? `${v.name}을(를) 취소합니다. 살아있는 청약 ${v.pendingCount + v.confirmedCount}건이 모두 거부 처리되고, 대기 중이던 줍스는 지상으로 돌아갑니다.`
        : `${v.name}을(를) 발사됨으로 표시합니다. 이 작업은 되돌릴 수 없습니다.`;
    if (!window.confirm(message)) return;

    setErrors((e) => ({ ...e, [v.id]: "" }));
    startTransition(async () => {
      const res = await setVehicleStatus(v.id, next);
      if (res.ok) router.refresh();
      else setErrors((e) => ({ ...e, [v.id]: res.error }));
    });
  };

  if (vehicles.length === 0) {
    return <p className={mutedTextClass}>등록된 발사체가 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead>
          <tr>
            {["이름", "제공사", "발사장", "발사 일시", "확정/정원", "대기", "필요Lv", "상태", ""].map(
              (h) => (
                <th key={h} className={thClass} style={cellBorderStyle}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => {
            const err = errors[v.id];
            return (
              <Fragment key={v.id}>
                <tr>
                  <td className={tdClass} style={cellBorderStyle}>
                    <Link href={`/admin/launch/${v.id}`} className="underline">
                      {v.name}
                    </Link>
                  </td>
                  <td className={tdClass} style={cellBorderStyle}>
                    {v.provider}
                  </td>
                  <td className={tdClass} style={cellBorderStyle}>
                    {v.site}
                  </td>
                  <td className={tdClass} style={cellBorderStyle}>
                    {formatDateTime(v.launchAt)}
                  </td>
                  <td
                    className={tdClass}
                    style={{
                      ...cellBorderStyle,
                      color: v.overCapacity ? "var(--color-danger)" : undefined,
                    }}
                  >
                    {v.confirmedCount}/{v.capacity}
                    {v.overCapacity && " !"}
                  </td>
                  <td className={tdClass} style={cellBorderStyle}>
                    {v.pendingCount}
                  </td>
                  <td className={tdClass} style={cellBorderStyle}>
                    {v.requiredLevel}
                  </td>
                  <td className={tdClass} style={cellBorderStyle}>
                    <span className={badgeClass} style={statusStyle(STATUS_TONE[v.status])}>
                      {STATUS_LABEL[v.status]}
                    </span>
                  </td>
                  <td className={tdClass} style={cellBorderStyle}>
                    <div className="flex flex-wrap gap-1.5">
                      <Link
                        href={`/admin/launch/${v.id}`}
                        className={btnGhostClass}
                        style={btnGhostStyle}
                      >
                        선별
                      </Link>
                      {v.status === "scheduled" && (
                        <>
                          <button
                            type="button"
                            className={btnGhostClass}
                            style={btnGhostStyle}
                            onClick={() => setEditing(editing === v.id ? null : v.id)}
                          >
                            {editing === v.id ? "닫기" : "수정"}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            className={btnGhostClass}
                            style={btnGhostStyle}
                            onClick={() => changeStatus(v, "launched")}
                          >
                            발사
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            className={btnGhostClass}
                            style={btnDangerStyle}
                            onClick={() => changeStatus(v, "cancelled")}
                          >
                            취소
                          </button>
                        </>
                      )}
                    </div>
                    {err && <p className={`mt-1 ${errorTextClass}`}>{ERRORS[err] ?? err}</p>}
                  </td>
                </tr>

                {editing === v.id && (
                  <tr>
                    <td colSpan={9} className="px-3 py-4" style={{ background: "var(--color-bg)" }}>
                      <AdminVehicleForm
                        vehicle={v}
                        defaultRequiredLevel={defaultRequiredLevel}
                        onDone={() => setEditing(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
