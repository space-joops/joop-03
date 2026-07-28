"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { returnToEarth } from "@/app/[lang]/joop/map/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

// 지구 복귀 버튼 — 되돌리기 쉬운 액션이 아니라(재발사에 청약이 다시 필요)
// 2단 확인: 첫 탭에 문구가 "정말 복귀할까요?"로 바뀌고, 다시 탭해야 실행된다.
export function ReturnEarthButton({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.space;
  const router = useRouter();
  const [arming, setArming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (!arming) {
      setArming(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await returnToEarth();
      if (res.ok) {
        router.push(`/${lang}/joop`);
      } else {
        setError(res.error);
        setArming(false);
      }
    } catch {
      setError("network");
      setArming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        onClick={onClick}
        disabled={busy}
        className="crt-brackets btn-brackets text-xs"
        style={
          {
            "--bracket-color": arming ? "var(--color-danger)" : "var(--color-neutral-600)",
            color: arming ? "var(--color-danger)" : "var(--color-muted)",
          } as React.CSSProperties
        }
      >
        {busy ? t.returningEarth : arming ? t.returnEarthConfirm : t.returnEarth}
      </button>
      <p className="mt-1 text-center font-mono text-[10px] text-[var(--color-muted)]">
        {error ? (
          <span role="alert" className="text-[var(--color-danger)]">
            {t.returnEarthError} <span className="opacity-60">({error})</span>
          </span>
        ) : (
          t.returnEarthNote
        )}
      </p>
    </div>
  );
}
