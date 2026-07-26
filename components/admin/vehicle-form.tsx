"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  createVehicle,
  updateVehicle,
  type VehicleState,
} from "@/app/admin/(protected)/launch/actions";
import type { AdminVehicle } from "@/lib/admin/queries";
import {
  btnPrimaryClass,
  btnPrimaryStyle,
  errorTextClass,
  inputClass,
  inputStyle,
  labelClass,
  mutedTextClass,
  toDateTimeLocal,
} from "@/components/admin/ui";

const ERRORS: Record<string, string> = {
  auth: "권한이 없습니다. 다시 로그인하세요",
  name: "이름을 1~40자로 입력하세요",
  provider: "제공사를 1~40자로 입력하세요",
  site: "발사장을 1~80자로 입력하세요",
  launch_at: "발사 일시를 확인하세요",
  capacity: "정원은 1~1000 사이 정수여야 합니다",
  required_level: "필요 레벨은 1~100 사이 정수여야 합니다",
  not_found: "발사체를 찾을 수 없습니다",
  not_scheduled: "예정 상태인 발사체만 수정할 수 있습니다",
  save: "저장에 실패했습니다",
};

export function AdminVehicleForm({
  vehicle,
  defaultRequiredLevel,
  onDone,
}: {
  /** 없으면 신규 등록 폼 */
  vehicle?: AdminVehicle;
  defaultRequiredLevel: number;
  onDone?: () => void;
}) {
  const isEdit = !!vehicle;
  const [state, action, pending] = useActionState<VehicleState, FormData>(
    isEdit ? updateVehicle : createVehicle,
    null,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onDone?.();
    }
  }, [state, router, onDone]);

  const err = state && !state.ok ? state.error : null;
  const needsForce = err === "capacity_below_confirmed";

  return (
    <form action={action} className="flex flex-col gap-3">
      {isEdit && <input type="hidden" name="id" value={vehicle.id} />}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="이름" name="name" defaultValue={vehicle?.name} />
        <Field label="제공사" name="provider" defaultValue={vehicle?.provider} />
        <Field label="발사장" name="site" defaultValue={vehicle?.site} />
        <Field
          label="발사 일시"
          name="launch_at"
          type="datetime-local"
          defaultValue={vehicle ? toDateTimeLocal(vehicle.launchAt) : undefined}
        />
        <Field
          label="정원"
          name="capacity"
          type="number"
          defaultValue={vehicle ? String(vehicle.capacity) : "20"}
        />
        <Field
          label="필요 레벨"
          name="required_level"
          type="number"
          defaultValue={String(vehicle?.requiredLevel ?? defaultRequiredLevel)}
        />
      </div>

      {needsForce && (
        <div
          className="rounded-md border px-3 py-2"
          style={{ borderColor: "var(--color-danger)" }}
        >
          <p className={errorTextClass}>
            확정 청약 {state && !state.ok ? state.confirmedCount : 0}명보다 작은 정원은 저장할 수
            없습니다.
          </p>
          <label className={`mt-1.5 flex items-center gap-2 ${mutedTextClass}`}>
            <input type="checkbox" name="force" />
            초과 상태로 저장 — 누구를 내릴지는 선별 화면에서 직접 정합니다
          </label>
        </div>
      )}

      {err && !needsForce && <p className={errorTextClass}>{ERRORS[err] ?? err}</p>}

      <div>
        <button type="submit" disabled={pending} className={btnPrimaryClass} style={btnPrimaryStyle}>
          {pending ? "저장 중…" : isEdit ? "수정" : "등록"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`vf-${name}`} className={labelClass}>
        {label}
      </label>
      <input
        id={`vf-${name}`}
        name={name}
        type={type}
        defaultValue={defaultValue}
        className={inputClass}
        style={inputStyle}
      />
    </div>
  );
}
