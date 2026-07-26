"use client";

import { useActionState } from "react";
import {
  redeemInvite,
  joinWaitlist,
  type OnboardingState,
} from "@/app/[lang]/onboarding/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { ConsoleField } from "@/components/console-field";
import { PrimaryButton, SecondaryButton } from "@/components/console-button";

// ① 초대코드 입력 + 이메일 대기 등록 — docs/design/handoff-m2.md §3-2~3-4
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
  // 대기 등록 성공은 서버 액션이 error 채널로 "joined" 를 돌려주는 기존 계약을 그대로 쓴다.
  const joined = waitErr === "joined";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form action={inviteAction}>
        <ConsoleField
          id="invite-code"
          name="code"
          label={t.invite.label}
          placeholder={t.invite.placeholder}
          autoComplete="off"
          autoCapitalize="characters"
          display
          invalid={Boolean(inviteErr)}
          helper={inviteErr ? errors[inviteErr] : undefined}
          helperTone="err"
        />
        <div className="mt-4">
          <PrimaryButton type="submit" disabled={invitePending}>
            {t.invite.cta}
          </PrimaryButton>
        </div>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-[var(--color-muted)]">
        <span className="h-px flex-1" style={{ background: "var(--color-neutral-700)" }} />
        {t.divider}
        <span className="h-px flex-1" style={{ background: "var(--color-neutral-700)" }} />
      </div>

      <form action={waitAction}>
        <ConsoleField
          id="waitlist-email"
          name="email"
          type="email"
          inputMode="email"
          label={t.waitlist.label}
          placeholder={t.waitlist.placeholder}
          autoComplete="email"
          invalid={Boolean(waitErr) && !joined}
          helper={joined ? t.waitlist.done : waitErr ? errors[waitErr] : undefined}
          helperTone={joined ? "ok" : "err"}
          trailing={
            <SecondaryButton type="submit" disabled={waitPending} className="h-[52px] flex-none">
              {t.waitlist.cta}
            </SecondaryButton>
          }
        />
      </form>

      <p className="mt-auto pt-3 pb-[calc(var(--safe-bottom)+12px)] text-center text-xs leading-4 text-[var(--color-muted)]">
        {t.invite.footnote}
      </p>
    </div>
  );
}
