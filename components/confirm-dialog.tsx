"use client";

// 확인 다이얼로그 — handoff-m6.md §4-2.
// 용도 규칙: 되돌릴 수 없는 액션 전용(청약·아이템 사용 등). 얻는 행동은 토스트로 충분.
// 코너 나사 도트 4개는 카세트퓨처리즘 시그니처(M2 보급 카트리지와 동일 문법).
// 백드롭 탭 = 취소. pending 중에는 백드롭·버튼 모두 잠근다.
import { Button } from "./button";

const SCREW_POSITIONS = [
  { top: 7, left: 7 },
  { top: 7, right: 7 },
  { bottom: 7, left: 7 },
  { bottom: 7, right: 7 },
] as const;

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-5"
      style={{ background: "rgba(2, 4, 6, 0.6)" }}
      onClick={() => {
        if (!pending) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-[300px] rounded-[var(--radius-md)] border-2 px-4 py-[18px]"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-neutral-700)",
          boxShadow: "inset 0 1px 0 var(--bezel-highlight), 0 12px 40px rgba(0, 0, 0, 0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {SCREW_POSITIONS.map((pos, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute h-[5px] w-[5px] rounded-full"
            style={{ background: "var(--color-neutral-600)", ...pos }}
          />
        ))}
        <h3
          id="confirm-dialog-title"
          className="mb-1.5 text-[17px] leading-6 font-semibold text-[var(--color-fg)]"
        >
          {title}
        </h3>
        {body && <p className="text-xs leading-4 text-[var(--color-muted)]">{body}</p>}
        <div className="mt-3.5 flex gap-2.5">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={pending}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            className="min-h-11 flex-[1.4] text-[15px]"
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
