"use client";

// 미출시 탭(비활성) — handoff-m6.md §4-3 확정 스펙(2026-07-27 보강).
// 무반응 금지: 탭하면 정보 토스트("준비 중이에요") 3초. 눌림 효과 없음, 포커스 가능 유지.
import { useToast } from "@/components/toast";
import type { ReactNode } from "react";

export function ComingSoonTab({
  label,
  ariaSuffix,
  message,
  children,
}: {
  label: string;
  ariaSuffix: string; // "준비 중" — aria-label="{라벨} ({suffix})"
  message: string; // 토스트 본문 "준비 중이에요"
  children: ReactNode;
}) {
  const { showToast } = useToast();
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-label={`${label} (${ariaSuffix})`}
      onClick={() => showToast({ kind: "info", message })}
      className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 opacity-55"
      style={{ color: "var(--color-muted)" }}
    >
      <span className="grid place-items-center">{children}</span>
      <span className="text-[11px] leading-[14px]">{label}</span>
    </button>
  );
}
