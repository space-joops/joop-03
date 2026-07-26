"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveBooking, demoteBooking } from "@/app/admin/(protected)/launch/actions";
import type { AdminVehicle, BookingStatus, RosterEntry } from "@/lib/admin/queries";
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

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "대기",
  confirmed: "확정",
  rejected: "거부",
};

const STATUS_TONE: Record<BookingStatus, "ok" | "wait" | "bad"> = {
  pending: "wait",
  confirmed: "ok",
  rejected: "bad",
};

const ERRORS: Record<string, string> = {
  auth: "권한이 없습니다. 다시 로그인하세요",
  not_found: "청약을 찾을 수 없습니다",
  not_scheduled: "예정 상태인 발사체만 선별할 수 있습니다",
  full: "정원이 찼습니다",
  already_confirmed_elsewhere: "이 줍스는 다른 발사체에 이미 확정되어 있습니다",
  save: "저장에 실패했습니다",
};

export function AdminRoster({
  vehicle,
  roster,
}: {
  vehicle: AdminVehicle;
  roster: RosterEntry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<number, string>>({});

  const run = (id: number, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setErrors((e) => ({ ...e, [id]: "" }));
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setErrors((e) => ({ ...e, [id]: res.error ?? "save" }));
    });
  };

  const approve = (entry: RosterEntry, force = false) =>
    run(entry.bookingId, () => approveBooking(entry.bookingId, force));

  const demote = (entry: RosterEntry, to: "pending" | "rejected") =>
    run(entry.bookingId, () => demoteBooking(entry.bookingId, to));

  if (roster.length === 0) {
    return <p className={mutedTextClass}>아직 청약자가 없습니다.</p>;
  }

  const editable = vehicle.status === "scheduled";

  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead>
          <tr>
            {["줍스", "소유자", "레벨", "자격", "상태", "신청", ""].map((h) => (
              <th key={h} className={thClass} style={cellBorderStyle}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roster.map((entry) => {
            const err = errors[entry.bookingId];
            return (
              <tr key={entry.bookingId}>
                <td className={tdClass} style={cellBorderStyle}>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: entry.joopColor,
                        boxShadow: `0 0 6px ${entry.joopColor}`,
                      }}
                      aria-hidden
                    />
                    {entry.joopName}
                    <span className={mutedTextClass}>({entry.joopStatus})</span>
                  </span>
                </td>
                <td className={tdClass} style={cellBorderStyle}>
                  {entry.ownerName ?? <span className={mutedTextClass}>(이름 미설정)</span>}
                </td>
                <td className={tdClass} style={cellBorderStyle}>
                  {entry.level}
                </td>
                <td
                  className={tdClass}
                  style={{
                    ...cellBorderStyle,
                    color: entry.eligible ? "var(--color-primary)" : "var(--color-danger)",
                  }}
                >
                  {entry.eligible ? "충족" : `Lv.${vehicle.requiredLevel} 미달`}
                </td>
                <td className={tdClass} style={cellBorderStyle}>
                  <span className={badgeClass} style={statusStyle(STATUS_TONE[entry.status])}>
                    {STATUS_LABEL[entry.status]}
                  </span>
                </td>
                <td className={tdClass} style={cellBorderStyle}>
                  {formatDateTime(entry.createdAt)}
                </td>
                <td className={tdClass} style={cellBorderStyle}>
                  {editable ? (
                    <div className="flex flex-wrap gap-1.5">
                      {entry.status !== "confirmed" && (
                        <button
                          type="button"
                          disabled={pending}
                          className={btnGhostClass}
                          style={btnGhostStyle}
                          onClick={() => approve(entry)}
                        >
                          승인
                        </button>
                      )}
                      {entry.status === "confirmed" && (
                        <button
                          type="button"
                          disabled={pending}
                          className={btnGhostClass}
                          style={btnGhostStyle}
                          onClick={() => demote(entry, "pending")}
                        >
                          확정 취소
                        </button>
                      )}
                      {entry.status !== "rejected" && (
                        <button
                          type="button"
                          disabled={pending}
                          className={btnGhostClass}
                          style={btnDangerStyle}
                          onClick={() => demote(entry, "rejected")}
                        >
                          거부
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className={mutedTextClass}>—</span>
                  )}

                  {err && (
                    <div className="mt-1">
                      <p className={errorTextClass}>{ERRORS[err] ?? err}</p>
                      {err === "full" && (
                        <button
                          type="button"
                          disabled={pending}
                          className={`mt-1 ${btnGhostClass}`}
                          style={btnDangerStyle}
                          onClick={() => approve(entry, true)}
                        >
                          정원을 넘겨 승인
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
