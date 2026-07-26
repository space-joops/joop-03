/**
 * 물리 버튼 — docs/design/handoff-m1.md §5-5, handoff-m2.md §3-4.
 * PrimaryButton: 형광 채움 + 베젤 인셋 + 글로우. 형광 위 텍스트는 반드시 #05080a(흰색 금지).
 * SecondaryButton: 앰버 아웃라인. 주요 CTA 와 위계를 분리해야 하는 보조 동작에만.
 */
type ButtonProps = {
  children: React.ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

export function PrimaryButton({
  children,
  type = "button",
  disabled = false,
  onClick,
  className,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={[
        "w-full min-h-14 rounded-[var(--radius-sm)] border-2 px-4",
        "text-[17px] font-semibold leading-6 tracking-[0.02em]",
        "transition-transform duration-[var(--motion-fast)] ease-[var(--ease-console)]",
        "active:translate-y-px motion-reduce:transition-none",
        className ?? "",
      ].join(" ")}
      style={
        disabled
          ? {
              background: "var(--color-primary-dim)",
              borderColor: "var(--color-primary-dim)",
              color: "rgba(5,8,10,.7)",
            }
          : {
              background: "var(--color-primary)",
              borderColor: "#63ff47",
              color: "#05080a",
              boxShadow:
                "inset 0 2px 0 rgba(255,255,255,.35), inset 0 -3px 0 rgba(0,0,0,.35), var(--glow-primary)",
            }
      }
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  type = "button",
  disabled = false,
  onClick,
  className,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={[
        "min-h-11 rounded-[var(--radius-sm)] border-2 px-4",
        "text-[15px] font-semibold leading-[22px]",
        "transition-transform duration-[var(--motion-fast)] ease-[var(--ease-console)]",
        "active:translate-y-px disabled:opacity-60 motion-reduce:transition-none",
        className ?? "",
      ].join(" ")}
      style={{
        background: "transparent",
        borderColor: "var(--color-secondary)",
        color: "var(--color-secondary)",
        boxShadow: "0 0 6px rgba(255,176,0,.25)",
      }}
    >
      {children}
    </button>
  );
}
