"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import {
  redeemInvite,
  joinWaitlist,
  type OnboardingState,
} from "@/app/[lang]/onboarding/actions";
import { Button } from "@/components/button";
import { useToast } from "@/components/toast";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

function errorOf(state: OnboardingState): string | undefined {
  return state && "error" in state ? state.error : undefined;
}

export function OnboardingForm({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.onboarding;
  const errors = t.errors as Record<string, string>;
  const { showToast } = useToast();

  const [inviteState, inviteAction, invitePending] = useActionState<OnboardingState, FormData>(
    redeemInvite.bind(null, lang),
    null,
  );
  const [waitState, waitAction, waitPending] = useActionState<OnboardingState, FormData>(
    joinWaitlist.bind(null, lang),
    null,
  );

  const inviteErr = errorOf(inviteState);
  const waitErr = errorOf(waitState);

  // 대기리스트 등록 성공 = "얻는 행동" → 토스트 (handoff-m6.md §4-1).
  // waitState 는 제출마다 새 객체라 성공 1회당 1번 발화한다.
  useEffect(() => {
    if (waitState?.ok) showToast({ kind: "success", message: t.joined });
  }, [waitState, showToast, t.joined]);

  const fieldClass =
    "w-full rounded-md border px-3 py-2.5 font-mono text-sm text-[var(--color-fg)] outline-none";
  const fieldStyle = {
    background: "var(--color-surface)",
    borderColor: "var(--color-neutral-600)",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 초대 코드 */}
      <form action={inviteAction} className="flex flex-col gap-2">
        <label className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {t.inviteLabel}
        </label>
        <input
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
        <Button type="submit" variant="primary" disabled={invitePending} className="mt-1 w-full">
          {t.redeem}
        </Button>
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
        {waitErr && (
          <p className="font-mono text-xs text-[var(--color-danger)]">{errors[waitErr]}</p>
        )}
        <Button type="submit" variant="secondary" disabled={waitPending} className="mt-1 w-full">
          {t.join}
        </Button>
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
