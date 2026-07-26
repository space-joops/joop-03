"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  issueInviteCodes,
  revokeInviteCode,
  type InviteState,
} from "@/app/admin/(protected)/invites/actions";
import type { AdminInvite, InviteStatus } from "@/lib/admin/queries";
import { MAX_BATCH } from "@/lib/admin/invite-codes";
import {
  badgeClass,
  btnGhostClass,
  btnGhostStyle,
  btnDangerStyle,
  btnPrimaryClass,
  btnPrimaryStyle,
  cellBorderStyle,
  errorTextClass,
  formatDateTime,
  inputClass,
  inputStyle,
  labelClass,
  mutedTextClass,
  okTextClass,
  panelClass,
  panelStyle,
  statusStyle,
  tableClass,
  tdClass,
  thClass,
} from "@/components/admin/ui";

const STATUS_LABEL: Record<InviteStatus, string> = {
  active: "미사용",
  used: "사용됨",
  revoked: "폐기",
};

const STATUS_TONE: Record<InviteStatus, "ok" | "wait" | "bad"> = {
  active: "ok",
  used: "wait",
  revoked: "bad",
};

const ISSUE_ERRORS: Record<string, string> = {
  auth: "권한이 없습니다. 다시 로그인하세요",
  label: "라벨은 영문 대문자·숫자 2~10자여야 합니다",
  count: `개수는 1~${MAX_BATCH} 사이여야 합니다`,
  email: "올바른 이메일을 입력하세요",
  label_full: "이 라벨의 번호(99)를 다 썼습니다. 새 라벨을 쓰세요",
  collision: "동시 발급이 겹쳤습니다. 다시 시도하세요",
  save: "발급에 실패했습니다",
};

const REVOKE_ERRORS: Record<string, string> = {
  auth: "권한이 없습니다. 다시 로그인하세요",
  not_found: "코드를 찾을 수 없습니다",
  already_used: "이미 사용된 코드는 폐기할 수 없습니다",
  save: "처리에 실패했습니다",
};

export function AdminInvitePanel({ invites }: { invites: AdminInvite[] }) {
  const router = useRouter();
  const [state, action, issuing] = useActionState<InviteState, FormData>(issueInviteCodes, null);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const issued = state?.ok ? state.codes : [];

  const revoke = (code: string) => {
    setErrors((e) => ({ ...e, [code]: "" }));
    startTransition(async () => {
      const res = await revokeInviteCode(code);
      if (res.ok) router.refresh();
      else setErrors((e) => ({ ...e, [code]: res.error }));
    });
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(issued.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const counts = {
    active: invites.filter((i) => i.status === "active").length,
    used: invites.filter((i) => i.status === "used").length,
    revoked: invites.filter((i) => i.status === "revoked").length,
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_1fr]">
      <div className={panelClass} style={panelStyle}>
        <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-[var(--color-fg)]">
          코드 발급
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>
          코드는 <span className="font-mono">JOOP-라벨-번호</span> 형식으로 만들어집니다. 같은
          라벨로 다시 발급하면 번호가 이어집니다.
        </p>

        <form action={action} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="inv-label" className={labelClass}>
              라벨
            </label>
            <input
              id="inv-label"
              name="label"
              placeholder="GAMMA"
              autoCapitalize="characters"
              autoComplete="off"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="inv-count" className={labelClass}>
              개수
            </label>
            <input
              id="inv-count"
              name="count"
              type="number"
              defaultValue={5}
              min={1}
              max={MAX_BATCH}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="inv-email" className={labelClass}>
              대상 이메일 (선택)
            </label>
            <input
              id="inv-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              className={inputClass}
              style={inputStyle}
            />
            <p className={mutedTextClass}>입력하면 이 사람 전용 코드 1개만 발급합니다.</p>
          </div>

          {state && !state.ok && (
            <p className={errorTextClass}>{ISSUE_ERRORS[state.error] ?? state.error}</p>
          )}

          <button
            type="submit"
            disabled={issuing}
            className={btnPrimaryClass}
            style={btnPrimaryStyle}
          >
            {issuing ? "발급 중…" : "발급"}
          </button>
        </form>

        {issued.length > 0 && (
          <div className="mt-4">
            <p className={okTextClass}>{issued.length}개를 발급했습니다.</p>
            <ul className="mt-2 flex flex-col gap-1">
              {issued.map((code) => (
                <li key={code} className="font-mono text-sm tracking-wider text-[var(--color-fg)]">
                  {code}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={copyAll}
              className={`mt-2 ${btnGhostClass}`}
              style={btnGhostStyle}
            >
              {copied ? "복사됨" : "전체 복사"}
            </button>
          </div>
        )}
      </div>

      <div className={panelClass} style={panelStyle}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={badgeClass} style={statusStyle("ok")}>
            미사용 {counts.active}
          </span>
          <span className={badgeClass} style={statusStyle("wait")}>
            사용됨 {counts.used}
          </span>
          <span className={badgeClass} style={statusStyle("bad")}>
            폐기 {counts.revoked}
          </span>
        </div>

        {invites.length === 0 ? (
          <p className={mutedTextClass}>발급된 코드가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  {["코드", "상태", "대상", "소진자", "소진 시각", ""].map((h) => (
                    <th key={h} className={thClass} style={cellBorderStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const err = errors[inv.code];
                  return (
                    <tr key={inv.code}>
                      <td
                        className={`${tdClass} tracking-wider`}
                        style={cellBorderStyle}
                      >
                        {inv.code}
                      </td>
                      <td className={tdClass} style={cellBorderStyle}>
                        <span className={badgeClass} style={statusStyle(STATUS_TONE[inv.status])}>
                          {STATUS_LABEL[inv.status]}
                        </span>
                      </td>
                      <td className={tdClass} style={cellBorderStyle}>
                        {inv.email ?? <span className={mutedTextClass}>—</span>}
                      </td>
                      <td className={tdClass} style={cellBorderStyle}>
                        {inv.redeemedByName ?? <span className={mutedTextClass}>—</span>}
                      </td>
                      <td className={tdClass} style={cellBorderStyle}>
                        {formatDateTime(inv.redeemedAt)}
                      </td>
                      <td className={tdClass} style={cellBorderStyle}>
                        {inv.status === "active" && (
                          <button
                            type="button"
                            disabled={pending}
                            className={btnGhostClass}
                            style={btnDangerStyle}
                            onClick={() => revoke(inv.code)}
                          >
                            폐기
                          </button>
                        )}
                        {err && (
                          <p className={`mt-1 ${errorTextClass}`}>{REVOKE_ERRORS[err] ?? err}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
