/**
 * 콘솔 텍스트 필드 — docs/design/handoff-m2.md §3-2.
 * 높이 52, surface-raised 바탕 + 2px 베젤 + 인셋 하이라이트/섀도, 포커스 시 형광 보더 + 글로우.
 * `display` 를 켜면 도트매트릭스 계기 폰트(숫자·라틴 대문자 전용) — 초대코드 입력용.
 */
export type FieldTone = "muted" | "ok" | "err";

const TONE_COLOR: Record<FieldTone, string> = {
  muted: "var(--color-muted)",
  ok: "var(--color-success)",
  err: "var(--color-danger)",
};

export function ConsoleField({
  id,
  name,
  label,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
  autoCapitalize,
  maxLength,
  defaultValue,
  display = false,
  invalid = false,
  helper,
  helperTone = "muted",
  onChange,
  trailing,
}: {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  type?: "text" | "email";
  inputMode?: "text" | "email";
  autoComplete?: string;
  autoCapitalize?: "off" | "characters";
  maxLength?: number;
  defaultValue?: string;
  /** 계기판 느낌(도트매트릭스 + 자간). 한글이 들어갈 수 있는 필드에는 쓰지 않는다 */
  display?: boolean;
  invalid?: boolean;
  helper?: string;
  helperTone?: FieldTone;
  onChange?: (value: string) => void;
  /** 입력창 오른쪽에 같은 줄로 붙는 요소(대기 등록 버튼 등). 라벨·헬퍼는 전체 폭을 유지한다 */
  trailing?: React.ReactNode;
}) {
  const helperId = `${id}-helper`;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs leading-4 text-[var(--color-muted)]">
        {label}
      </label>
      <div className="flex items-start gap-2">
        <input
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect="off"
          spellCheck={false}
          maxLength={maxLength}
          defaultValue={defaultValue}
          aria-invalid={invalid || undefined}
          aria-describedby={helper ? helperId : undefined}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={[
            "console-caret h-[52px] min-w-0 flex-1 rounded-[var(--radius-sm)] border-2 px-3.5 outline-none",
            "border-[var(--color-neutral-700)] bg-[var(--color-surface-raised)] text-[var(--color-fg)]",
            "shadow-[inset_0_1px_0_var(--bezel-highlight),inset_0_-2px_4px_var(--bezel-shadow)]",
            "placeholder:text-[var(--color-muted)]",
            "focus:border-[var(--color-primary)]",
            "focus:shadow-[inset_0_1px_0_var(--bezel-highlight),var(--glow-focus)]",
            "aria-[invalid=true]:border-[var(--color-danger)]",
            display
              ? "font-display text-[22px] tracking-[0.12em] uppercase text-[var(--color-primary)] placeholder:tracking-[0.08em] placeholder:normal-case"
              : "font-mono text-[17px]",
          ].join(" ")}
        />
        {trailing}
      </div>
      {helper && (
        <p
          id={helperId}
          role={helperTone === "err" ? "alert" : undefined}
          className="mt-1.5 text-xs leading-4"
          style={{ color: TONE_COLOR[helperTone] }}
        >
          {helper}
        </p>
      )}
    </div>
  );
}
