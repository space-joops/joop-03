/**
 * 세그먼트 바 — docs/design/design-tokens.md §4 / handoff-m2.md §3-5.
 * 점등 = primary + 글로우, 소등 = primary-dim 35%. 첫 화면 게이지와 같은 문법.
 * 순수 표현 요소라 aria-hidden — 진행 상태는 옆의 텍스트가 알린다.
 */
export function SegmentBar({
  segments,
  filled,
  height = 14,
  gap = 3,
  className,
}: {
  segments: number;
  filled: number;
  height?: number;
  gap?: number;
  className?: string;
}) {
  return (
    <div className={`flex${className ? ` ${className}` : ""}`} style={{ gap, height }} aria-hidden>
      {Array.from({ length: segments }).map((_, i) => (
        <span
          key={i}
          className="flex-1 rounded-[var(--radius-xs)]"
          style={
            i < filled
              ? { background: "var(--color-primary)", boxShadow: "var(--glow-primary)" }
              : {
                  background:
                    "color-mix(in srgb, var(--color-primary-dim) 35%, transparent)",
                }
          }
        />
      ))}
    </div>
  );
}
