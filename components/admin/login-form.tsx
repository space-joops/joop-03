"use client";

import { useActionState } from "react";
import { loginAdmin, type AdminLoginState } from "@/app/admin/actions";
import {
  btnPrimaryClass,
  btnPrimaryStyle,
  errorTextClass,
  inputClass,
  inputStyle,
  labelClass,
} from "@/components/admin/ui";

// 관리자 콘솔은 운영자 전용 내부 도구라 i18n 사전을 쓰지 않고 한국어를 직접 쓴다.
const ERRORS: Record<string, string> = {
  empty: "비밀번호를 입력하세요",
  invalid: "비밀번호가 올바르지 않습니다",
  config: "서버에 관리자 설정이 없습니다 (ADMIN_PASSWORD / ADMIN_SESSION_SECRET)",
  locked: "실패 횟수가 많습니다. 잠시 후 다시 시도하세요",
};

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<AdminLoginState, FormData>(loginAdmin, null);
  const err = state?.error;

  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="admin-password" className={labelClass}>
        관리자 비밀번호
      </label>
      <input
        id="admin-password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        className={inputClass}
        style={inputStyle}
      />
      {err && <p className={errorTextClass}>{ERRORS[err] ?? err}</p>}
      <button
        type="submit"
        disabled={pending}
        className={`mt-2 ${btnPrimaryClass} py-3`}
        style={btnPrimaryStyle}
      >
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
