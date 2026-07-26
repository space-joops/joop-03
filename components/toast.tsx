"use client";

// 전역 토스트 — handoff-m6.md §4-1.
// 단일 슬롯(최대 1개): 새 토스트가 기존 것을 즉시 대체한다. 성공·정보 3초 / 오류 5초 자동 소멸.
// 호출자가 번역 완료된 문자열을 넘긴다(dict 는 페이지 prop 이라는 서버 번역 원칙 유지, ADR-0001).
import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";

type ToastKind = "success" | "error" | "info";

type ToastInput = { kind: ToastKind; message: string };

type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<{ showToast: (t: ToastInput) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast 는 <ToastProvider> 안에서만 사용할 수 있습니다");
  return ctx;
}

const BORDER: Record<ToastKind, string> = {
  success: "var(--color-success)",
  error: "var(--color-danger)",
  info: "var(--color-neutral-700)",
};

const GLOW: Record<ToastKind, string> = {
  success: "0 0 10px rgba(0, 224, 143, 0.2)",
  error: "0 0 10px rgba(255, 69, 69, 0.2)",
  info: "none",
};

function ToastIcon({ kind }: { kind: ToastKind }) {
  // 18px 인라인 아이콘(§4-1) — 체크(성공) / X(오류·정보와 무관해 정보는 아이콘 없음)
  if (kind === "info") return null;
  const color = kind === "success" ? "var(--color-success)" : "var(--color-danger)";
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="square"
      aria-hidden
      className="shrink-0"
    >
      {kind === "success" ? (
        <path d="M4 13 L10 19 L20 6" />
      ) : (
        <path d="M6 6 L18 18 M18 6 L6 18" />
      )}
    </svg>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback(({ kind, message }: ToastInput) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = ++idRef.current;
    setToast({ id, kind, message });
    timerRef.current = setTimeout(
      () => setToast((cur) => (cur?.id === id ? null : cur)),
      kind === "error" ? 5000 : 3000,
    );
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          className="pointer-events-none fixed inset-x-0 top-[calc(max(env(safe-area-inset-top),12px)+8px)] z-60 mx-auto w-full max-w-md px-[var(--page-pad-x)]"
          role={toast.kind === "error" ? "alert" : "status"}
        >
          <div
            // key 로 슬롯 교체 시 등장 애니메이션 재생 (toast-enter 는 globals.css)
            key={toast.id}
            className="toast-enter flex items-center gap-2.5 rounded-[var(--radius-sm)] border-2 px-3.5 py-2.5"
            style={{
              background: "rgba(13, 20, 18, 0.92)",
              borderColor: BORDER[toast.kind],
              boxShadow: GLOW[toast.kind],
            }}
          >
            <ToastIcon kind={toast.kind} />
            <p className="text-[13px] leading-[18px] text-[var(--color-fg)]">{toast.message}</p>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
