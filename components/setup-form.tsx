"use client";

import { useActionState, useState } from "react";
import { completeSetup, type SetupState } from "@/app/[lang]/onboarding/setup/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

const COLORS = ["#35e07a", "#ffb23e", "#38e0f0", "#ff5c77", "#c8ff00", "#ff00d4"];

export function SetupForm({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.onboarding.setup;
  const errorMap: Record<string, string> = {
    name_len: t.nameLen,
    name_taken: t.nameTaken,
    color: t.colorErr,
  };
  const [color, setColor] = useState(COLORS[0]);
  const [state, action, pending] = useActionState<SetupState, FormData>(
    completeSetup.bind(null, lang),
    null,
  );
  const err = state?.error;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {t.nameLabel}
        </label>
        <input
          name="name"
          placeholder={t.namePlaceholder}
          maxLength={20}
          autoComplete="off"
          className="w-full rounded-md border px-3 py-2.5 font-mono text-sm text-[var(--color-fg)] outline-none"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-neutral-600)" }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {t.colorLabel}
        </label>
        <input type="hidden" name="color" value={color} />
        <div className="flex gap-3">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              aria-pressed={c === color}
              className="h-9 w-9 rounded-full"
              style={{
                background: c,
                boxShadow: c === color ? `0 0 0 3px var(--color-bg), 0 0 0 5px ${c}` : "none",
              }}
            />
          ))}
        </div>
      </div>

      {err && <p className="font-mono text-xs text-[var(--color-danger)]">{errorMap[err] ?? ""}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md py-3 font-mono text-sm font-semibold uppercase tracking-widest disabled:opacity-60"
        style={{ background: "var(--color-primary)", color: "var(--color-bg)" }}
      >
        {t.complete}
      </button>
    </form>
  );
}
