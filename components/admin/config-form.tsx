"use client";

import { useActionState } from "react";
import { updateGameConfig, type ConfigState } from "@/app/admin/(protected)/config/actions";
import {
  CONFIG_GROUP_LABELS,
  type ConfigGroup,
  type ConfigSpec,
} from "@/lib/config-specs";
import {
  badgeClass,
  btnPrimaryClass,
  btnPrimaryStyle,
  errorTextClass,
  inputClass,
  inputStyle,
  labelClass,
  mutedTextClass,
  okTextClass,
  panelClass,
  panelStyle,
  statusStyle,
  formatDateTime,
} from "@/components/admin/ui";

const FIELD_ERRORS: Record<string, string> = {
  empty: "값을 입력하세요",
  type: "숫자 형식이 올바르지 않습니다",
  range: "허용 범위를 벗어났습니다",
};

const STATE_ERRORS: Record<string, string> = {
  auth: "권한이 없습니다. 다시 로그인하세요",
  invalid: "입력값을 확인하세요",
  save: "저장에 실패했습니다",
};

export type ConfigFieldView = {
  spec: ConfigSpec;
  value: number;
  /** DB 에 행이 없어 폴백을 쓰는 중인지 */
  unset: boolean;
  updatedAt: string | null;
};

export function AdminConfigForm({
  group,
  fields,
}: {
  group: ConfigGroup;
  fields: ConfigFieldView[];
}) {
  const [state, action, pending] = useActionState<ConfigState, FormData>(updateGameConfig, null);

  const fieldErrors = state && !state.ok ? (state.fields ?? {}) : {};
  const savedKeys = state?.ok ? state.updated : [];

  return (
    <form action={action} className={panelClass} style={panelStyle}>
      <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-[var(--color-fg)]">
        {CONFIG_GROUP_LABELS[group]}
      </h2>

      <div className="mt-4 flex flex-col gap-5">
        {fields.map(({ spec, value, unset, updatedAt }) => {
          const err = fieldErrors[spec.key];
          return (
            <div key={spec.key} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={spec.key} className={labelClass}>
                  {spec.label}
                </label>
                {spec.restartRequired && (
                  <span className={badgeClass} style={statusStyle("wait")}>
                    재시작 시 반영
                  </span>
                )}
                {unset && (
                  <span className={badgeClass} style={statusStyle("idle")}>
                    미설정(기본값)
                  </span>
                )}
              </div>

              <p className={mutedTextClass}>{spec.description}</p>
              {spec.warn && <p className={errorTextClass}>{spec.warn}</p>}

              <div className="flex items-center gap-2">
                <input
                  id={spec.key}
                  name={spec.key}
                  type="number"
                  defaultValue={value}
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  className={`${inputClass} max-w-56`}
                  style={inputStyle}
                />
                {spec.unit && <span className={mutedTextClass}>{spec.unit}</span>}
              </div>

              <p className={mutedTextClass}>
                허용 {spec.min} ~ {spec.max} · 기본값 {spec.fallback}
                {updatedAt ? ` · 수정 ${formatDateTime(updatedAt)}` : ""}
              </p>

              {err && <p className={errorTextClass}>{FIELD_ERRORS[err] ?? err}</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button type="submit" disabled={pending} className={btnPrimaryClass} style={btnPrimaryStyle}>
          {pending ? "저장 중…" : "저장"}
        </button>

        {state?.ok && (
          <p className={okTextClass}>
            {savedKeys.length === 0
              ? "변경된 값이 없습니다"
              : `${savedKeys.length}개 항목을 저장했습니다`}
          </p>
        )}
        {state && !state.ok && (
          <p className={errorTextClass}>{STATE_ERRORS[state.error] ?? state.error}</p>
        )}
      </div>
    </form>
  );
}
