"use client";

import { JOOP_COLORS, JOOP_COLOR_NAMES, type JoopColorName } from "@/lib/joop-colors";

/**
 * 줍스 색 스와치 — docs/design/handoff-m2.md §3-6.
 * 44×44 원형(터치 타깃 충족) + 내부 24px 색 원. 선택 시 보더·글로우가 해당 색으로.
 *
 * a11y: radiogroup 관례를 따른다 — 그룹 안에서 Tab 은 한 번만 멈추고(roving tabindex)
 * ←/→/↑/↓/Home/End 로 이동하며 이동 즉시 선택된다.
 */
export function JoopColorSwatches({
  value,
  onChange,
  groupLabel,
  colorLabels,
}: {
  value: JoopColorName;
  onChange: (color: JoopColorName) => void;
  groupLabel: string;
  colorLabels: Record<JoopColorName, string>;
}) {
  const move = (delta: number) => {
    const i = JOOP_COLOR_NAMES.indexOf(value);
    const next = (i + delta + JOOP_COLOR_NAMES.length) % JOOP_COLOR_NAMES.length;
    onChange(JOOP_COLOR_NAMES[next]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        onChange(JOOP_COLOR_NAMES[0]);
        break;
      case "End":
        e.preventDefault();
        onChange(JOOP_COLOR_NAMES[JOOP_COLOR_NAMES.length - 1]);
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      onKeyDown={onKeyDown}
      className="flex justify-center gap-3"
    >
      {JOOP_COLOR_NAMES.map((name) => {
        const hex = JOOP_COLORS[name];
        const selected = name === value;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={colorLabels[name]}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(name)}
            className="grid h-11 w-11 place-items-center rounded-full border-2 transition-transform duration-[var(--motion-fast)] ease-[var(--ease-console)] active:translate-y-px motion-reduce:transition-none"
            style={{
              background: "var(--color-surface-raised)",
              borderColor: selected ? hex : "var(--color-neutral-700)",
              boxShadow: selected
                ? `0 0 8px ${hex}`
                : "inset 0 1px 0 var(--bezel-highlight), inset 0 -2px 4px var(--bezel-shadow)",
            }}
          >
            <span className="h-6 w-6 rounded-full" style={{ background: hex }} />
          </button>
        );
      })}
    </div>
  );
}
