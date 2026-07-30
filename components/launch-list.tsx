"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookLaunch } from "@/app/[lang]/launch/actions";
import type { LaunchVehicle } from "@/lib/launch";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { trackLaunchBooked } from "@/lib/analytics";

export function LaunchList({
  lang,
  dict,
  vehicles,
  myLevel,
}: {
  lang: Locale;
  dict: Dictionary;
  vehicles: LaunchVehicle[];
  myLevel: number;
}) {
  const t = dict.launch;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [booked, setBooked] = useState<{ name: string; status: string } | null>(null);

  const statusLabel = (s: string) =>
    s === "confirmed" ? t.confirmed : s === "pending" ? t.pending : t.rejected;

  const book = (id: string, name: string) => {
    setErrors((e) => ({ ...e, [id]: "" }));
    startTransition(async () => {
      const res = await bookLaunch(lang, id);
      if (res.ok) {
        trackLaunchBooked(res.status);
        setLocalStatus((s) => ({ ...s, [id]: res.status }));
        setBooked({ name, status: res.status });
        router.refresh();
      } else {
        setErrors((e) => ({ ...e, [id]: res.error }));
      }
    });
  };

  return (
    <>
      <ul className="flex flex-col gap-3">
      {vehicles.map((v) => {
        const myStatus = localStatus[v.id] ?? v.myStatus;
        const eligible = myLevel >= v.requiredLevel;
        const full = v.confirmedCount >= v.capacity;
        const err = errors[v.id];

        return (
          <li
            key={v.id}
            className="rounded-lg border p-4"
            style={{ borderColor: "var(--color-neutral-600)", background: "var(--color-surface)" }}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-base font-semibold text-[var(--color-fg)]">
                {v.name}
              </span>
              <span className="font-mono text-xs text-[var(--color-muted)]">{v.provider}</span>
            </div>
            <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">{v.site}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
              <span>{v.launchAt.slice(0, 10)}</span>
              <span>
                {t.capacity} {v.confirmedCount}/{v.capacity}
              </span>
              <span style={{ color: eligible ? "var(--color-primary)" : "var(--color-danger)" }}>
                {t.requiredLevel} {v.requiredLevel}
              </span>
            </div>

            <div className="mt-3">
              {myStatus ? (
                <span
                  className="inline-block rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-widest"
                  style={{
                    borderColor:
                      myStatus === "confirmed" ? "var(--color-primary)" : "var(--color-neutral-600)",
                    color:
                      myStatus === "confirmed" ? "var(--color-primary)" : "var(--color-muted)",
                  }}
                >
                  {statusLabel(myStatus)}
                </span>
              ) : eligible ? (
                <button
                  onClick={() => book(v.id, v.name)}
                  disabled={pending}
                  className="rounded-md px-4 py-2 font-mono text-xs font-semibold uppercase tracking-widest disabled:opacity-60"
                  style={{ background: "var(--color-primary)", color: "var(--color-bg)" }}
                >
                  {full ? t.bookWaitlist : t.book}
                </button>
              ) : (
                <span className="font-mono text-xs text-[var(--color-danger)]">
                  {t.needLevel.replace("{level}", String(v.requiredLevel))}
                </span>
              )}
              {err && (
                <p className="mt-1 font-mono text-xs text-[var(--color-danger)]">
                  {t.errors?.[err as keyof typeof t.errors] ?? err}
                </p>
              )}
            </div>
          </li>
        );
      })}
      </ul>

      {booked && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
        >
          <div
            className="crt-brackets flex w-full max-w-xs flex-col items-center gap-3 px-5 py-6 text-center"
            style={{ "--bracket-color": "var(--color-primary)", background: "var(--color-bg)" } as React.CSSProperties}
          >
            <h2 className="font-mono text-base font-semibold text-[var(--color-primary)]">
              {t.bookedTitle}
            </h2>
            <p className="font-mono text-sm text-[var(--color-fg)]">
              {booked.name} · {statusLabel(booked.status)}
            </p>
            <button
              onClick={() => router.push(`/${lang}/joop`)}
              className="rounded-md px-6 py-2.5 font-mono text-sm font-semibold uppercase tracking-widest"
              style={{ background: "var(--color-primary)", color: "var(--color-bg)" }}
            >
              {t.backToHub}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
