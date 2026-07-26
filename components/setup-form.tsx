"use client";

import { useActionState, useState } from "react";
import { completeSetup, type SetupState } from "@/app/[lang]/onboarding/setup/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import {
  DEFAULT_JOOP_COLOR,
  joopColorHex,
  type JoopColorName,
} from "@/lib/joop-colors";
import { ConsoleField } from "@/components/console-field";
import { PrimaryButton } from "@/components/console-button";
import { JoopCharacter } from "@/components/joop-character";
import { JoopColorSwatches } from "@/components/joop-color-swatches";

// ③ 이름·색 설정 — docs/design/handoff-m2.md §3-6.
// 색을 고르면 --joop-accent 가 바뀌고 미리보기 캐릭터가 즉시 반응한다(시안의 핵심 인터랙션).
// 시안은 documentElement 에 변수를 심지만 여기서는 폼 루트에만 걸어 전역 오염을 피한다.
export function SetupForm({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.onboarding.setup;
  const errorMap: Record<string, string> = {
    name_len: t.nameLen,
    name_taken: t.nameTaken,
    color: t.colorErr,
  };
  const [color, setColor] = useState<JoopColorName>(DEFAULT_JOOP_COLOR);
  const [state, action, pending] = useActionState<SetupState, FormData>(
    completeSetup.bind(null, lang),
    null,
  );
  const err = state?.error;

  return (
    <form
      action={action}
      className="flex min-h-0 flex-1 flex-col"
      style={{ "--joop-accent": joopColorHex(color) } as React.CSSProperties}
    >
      <div className="mb-5 flex flex-col items-center">
        <JoopCharacter size={180} label={dict.onboarding.a11y.joopPreview} />
        <span
          aria-hidden
          className="-mt-1.5 h-3.5 w-[120px] rounded-[50%]"
          style={{
            // 바닥 글로우도 줍스 색을 따른다(시안은 그린으로 하드코딩되어 있었다).
            background:
              "radial-gradient(closest-side, color-mix(in srgb, var(--joop-accent) 18%, transparent), transparent)",
          }}
        />
      </div>

      <ConsoleField
        id="joop-name"
        name="name"
        label={t.nameLabel}
        placeholder={t.namePlaceholder}
        autoComplete="off"
        maxLength={20}
        invalid={err === "name_len" || err === "name_taken"}
        helper={err ? errorMap[err] : undefined}
        helperTone="err"
      />

      <div className="mt-4">
        <span className="mb-1.5 block text-xs leading-4 text-[var(--color-muted)]">
          {t.colorLabel}
        </span>
        <input type="hidden" name="color" value={joopColorHex(color)} />
        <JoopColorSwatches
          value={color}
          onChange={setColor}
          groupLabel={dict.onboarding.a11y.colorGroup}
          colorLabels={dict.onboarding.colors}
        />
      </div>

      <div className="mt-auto pt-3 pb-[calc(var(--safe-bottom)+12px)]">
        <PrimaryButton type="submit" disabled={pending}>
          {t.cta}
        </PrimaryButton>
      </div>
    </form>
  );
}
