"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookLaunch } from "@/app/[lang]/launch/actions";
import { Button } from "@/components/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import type { LaunchVehicle } from "@/lib/launch";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

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
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});
  // 청약은 되돌릴 수 없는 액션 → 확인 다이얼로그를 거친다 (handoff-m6.md §4-2)
  const [confirmTarget, setConfirmTarget] = useState<LaunchVehicle | null>(null);

  const book = (vehicle: LaunchVehicle) => {
    startTransition(async () => {
      const res = await bookLaunch(lang, vehicle.id);
      if (res.ok) {
        setLocalStatus((s) => ({ ...s, [vehicle.id]: res.status }));
        showToast({
          kind: "success",
          message: res.status === "confirmed" ? t.toastConfirmed : t.toastPending,
        });
        router.refresh();
      } else {
        showToast({
          kind: "error",
          message: t.errors?.[res.error as keyof typeof t.errors] ?? res.error,
        });
      }
      setConfirmTarget(null);
    });
  };

  const statusLabel = (s: string) =>
    s === "confirmed" ? t.confirmed : s === "pending" ? t.pending : t.rejected;

  return (
    <>
      <ul className="flex flex-col gap-3">
        {vehicles.map((v) => {
          const myStatus = localStatus[v.id] ?? v.myStatus;
          const eligible = myLevel >= v.requiredLevel;
          const full = v.confirmedCount >= v.capacity;

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
                  <Button
                    variant="primary"
                    className="min-h-11 px-4 text-[15px]"
                    onClick={() => setConfirmTarget(v)}
                    disabled={pending}
                  >
                    {full ? t.bookWaitlist : t.book}
                  </Button>
                ) : (
                  <span className="font-mono text-xs text-[var(--color-danger)]">
                    {t.needLevel.replace("{level}", String(v.requiredLevel))}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={confirmTarget !== null}
        title={t.confirmTitle.replace("{name}", confirmTarget?.name ?? "")}
        body={t.confirmBody}
        confirmLabel={
          confirmTarget && confirmTarget.confirmedCount >= confirmTarget.capacity
            ? t.bookWaitlist
            : t.book
        }
        cancelLabel={dict.common.cancel}
        pending={pending}
        onConfirm={() => confirmTarget && book(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}
