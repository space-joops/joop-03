"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  redeemInvite,
  joinWaitlist,
  type OnboardingState,
} from "@/app/[lang]/onboarding/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { trackWaitlistJoined } from "@/lib/analytics";

export function OnboardingForm({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.onboarding;
  const errors = t.errors as Record<string, string>;

  const [inviteState, inviteAction, invitePending] = useActionState<OnboardingState, FormData>(
    redeemInvite.bind(null, lang),
    null,
  );
  const [waitState, waitAction, waitPending] = useActionState<OnboardingState, FormData>(
    joinWaitlist.bind(null, lang),
    null,
  );

  const inviteErr = inviteState?.error;
  const waitErr = waitState?.error;

  // joinWaitlist는 redirect 없이 상태를 반환하므로(성공 신호 = error:"joined"),
  // 렌더 본문이 아니라 waitState 변화에 걸린 effect에서 1회만 발화한다.
  useEffect(() => {
    if (waitState?.error === "joined") trackWaitlistJoined();
  }, [waitState]);

  // 인벤토리 공유 링크(?code=)로 들어온 경우 코드 입력창을 미리 채운다.
  // useSearchParams 대신 마운트 후 DOM 을 직접 갱신 — 서버 렌더와 다른 값이라
  // 렌더 함수에서 초기값으로 쓰면 하이드레이션 불일치가 난다(effect 후 반영이 안전).
  const codeInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code && codeInputRef.current) codeInputRef.current.value = code.toUpperCase();
  }, []);

  const fieldClass =
    "w-full rounded-md border px-3 py-2.5 font-mono text-sm text-[var(--color-fg)] outline-none";
  const fieldStyle = {
    background: "var(--color-surface)",
    borderColor: "var(--color-neutral-600)",
  };
  const btnStyle = { background: "var(--color-primary)", color: "var(--color-bg)" };

  return (
    <div className="flex flex-col gap-6">
      {/* 초대 코드 */}
      <form action={inviteAction} className="flex flex-col gap-2">
        <label className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {t.inviteLabel}
        </label>
        <input
          ref={codeInputRef}
          name="code"
          placeholder={t.invitePlaceholder}
          autoComplete="off"
          autoCapitalize="characters"
          className={fieldClass}
          style={fieldStyle}
        />
        {inviteErr && (
          <p className="font-mono text-xs text-[var(--color-danger)]">{errors[inviteErr]}</p>
        )}
        <button
          type="submit"
          disabled={invitePending}
          className="mt-1 rounded-md py-3 font-mono text-sm font-semibold uppercase tracking-widest disabled:opacity-60"
          style={btnStyle}
        >
          {t.redeem}
        </button>
      </form>

      <div className="text-center font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
        {t.or}
      </div>

      {/* 이메일 대기리스트 */}
      <form action={waitAction} className="flex flex-col gap-2">
        <label className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {t.waitlistLabel}
        </label>
        <input
          name="email"
          type="email"
          placeholder={t.waitlistPlaceholder}
          className={fieldClass}
          style={fieldStyle}
        />
        {waitErr === "joined" ? (
          <p className="font-mono text-xs text-[var(--color-primary)]">{t.joined}</p>
        ) : (
          waitErr && (
            <p className="font-mono text-xs text-[var(--color-danger)]">{errors[waitErr]}</p>
          )
        )}
        <button
          type="submit"
          disabled={waitPending}
          className="mt-1 rounded-md border py-3 font-mono text-sm font-semibold uppercase tracking-widest text-[var(--color-fg)] disabled:opacity-60"
          style={{ borderColor: "var(--color-neutral-600)" }}
        >
          {t.join}
        </button>
      </form>

      <Link
        href={`/${lang}`}
        className="text-center font-mono text-xs text-[var(--color-muted)] underline"
      >
        {t.back}
      </Link>
    </div>
  );
}
