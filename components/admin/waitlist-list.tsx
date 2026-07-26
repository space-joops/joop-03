"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueInviteForWaitlist } from "@/app/admin/(protected)/invites/actions";
import type { WaitlistEntry } from "@/lib/admin/queries";
import {
  badgeClass,
  btnGhostClass,
  btnGhostStyle,
  cellBorderStyle,
  errorTextClass,
  formatDateTime,
  mutedTextClass,
  statusStyle,
  tableClass,
  tdClass,
  thClass,
} from "@/components/admin/ui";

const ERRORS: Record<string, string> = {
  auth: "권한이 없습니다. 다시 로그인하세요",
  email: "이메일 형식이 올바르지 않습니다",
  not_in_waitlist: "대기리스트에 없는 이메일입니다",
  already_issued: "이미 미사용 코드가 발급되어 있습니다",
  save: "발급에 실패했습니다",
};

export function AdminWaitlistList({ entries }: { entries: WaitlistEntry[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const issue = (entry: WaitlistEntry) => {
    setErrors((e) => ({ ...e, [entry.id]: "" }));
    startTransition(async () => {
      const res = await issueInviteForWaitlist(entry.email);
      if (res.ok) router.refresh();
      else setErrors((e) => ({ ...e, [entry.id]: res.error }));
    });
  };

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  if (entries.length === 0) {
    return <p className={mutedTextClass}>대기리스트가 비어 있습니다.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead>
          <tr>
            {["이메일", "등록", "초대 상태", ""].map((h) => (
              <th key={h} className={thClass} style={cellBorderStyle}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const err = errors[entry.id];
            const inv = entry.invite;

            return (
              <tr key={entry.id}>
                <td className={tdClass} style={cellBorderStyle}>
                  {entry.email}
                </td>
                <td className={tdClass} style={cellBorderStyle}>
                  {formatDateTime(entry.createdAt)}
                </td>
                <td className={tdClass} style={cellBorderStyle}>
                  {!inv && (
                    <span className={badgeClass} style={statusStyle("idle")}>
                      미발급
                    </span>
                  )}
                  {inv?.status === "active" && (
                    <span className="flex items-center gap-2">
                      <span className={badgeClass} style={statusStyle("ok")}>
                        발급됨
                      </span>
                      <span className="tracking-wider">{inv.code}</span>
                    </span>
                  )}
                  {inv?.status === "used" && (
                    <span className={badgeClass} style={statusStyle("wait")}>
                      가입 완료 · {formatDateTime(inv.redeemedAt)}
                    </span>
                  )}
                  {inv?.status === "revoked" && (
                    <span className={badgeClass} style={statusStyle("bad")}>
                      폐기됨
                    </span>
                  )}
                </td>
                <td className={tdClass} style={cellBorderStyle}>
                  <div className="flex flex-wrap gap-1.5">
                    {(!inv || inv.status === "revoked") && (
                      <button
                        type="button"
                        disabled={pending}
                        className={btnGhostClass}
                        style={btnGhostStyle}
                        onClick={() => issue(entry)}
                      >
                        초대코드 발급
                      </button>
                    )}
                    {inv?.status === "active" && (
                      <>
                        <button
                          type="button"
                          className={btnGhostClass}
                          style={btnGhostStyle}
                          onClick={() => copy(inv.code)}
                        >
                          {copied === inv.code ? "복사됨" : "코드 복사"}
                        </button>
                        {/* 메일 발송 인프라가 없어 운영자의 메일 클라이언트를 연다. */}
                        <a
                          href={`mailto:${entry.email}?subject=${encodeURIComponent("줍스 초대 코드")}&body=${encodeURIComponent(`안녕하세요, 줍스입니다.\n\n초대 코드: ${inv.code}\n\n아래 화면에서 코드를 입력하면 줍스를 분양받을 수 있어요.\nhttps://joop-03.vercel.app/ko/onboarding\n`)}`}
                          className={btnGhostClass}
                          style={btnGhostStyle}
                        >
                          메일 쓰기
                        </a>
                      </>
                    )}
                  </div>
                  {err && <p className={`mt-1 ${errorTextClass}`}>{ERRORS[err] ?? err}</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
