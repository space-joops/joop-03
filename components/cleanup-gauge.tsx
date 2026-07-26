import type { Dictionary } from "@/lib/i18n/dictionaries";

// 누적 청소량 게이지 + 수치. 카세트퓨처리즘 세그먼트 계기 느낌.
export function CleanupGauge({
  totals,
  dict,
}: {
  totals: { debris: number; percent: number };
  dict: Dictionary;
}) {
  const segments = 24;
  const filled = Math.round((Math.min(100, Math.max(0, totals.percent)) / 100) * segments);

  return (
    <section className="px-4 py-3">
      <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
        <span>{dict.firstScreen.totalCollected}</span>
        <span className="text-[var(--color-primary)]">
          {totals.percent.toFixed(1)}% {dict.firstScreen.percentCleaned}
        </span>
      </div>

      <div className="mt-2 flex gap-[3px]" aria-hidden>
        {Array.from({ length: segments }).map((_, i) => (
          <span
            key={i}
            className="h-3 flex-1 rounded-[var(--radius-xs)]"
            style={{
              // 소등 세그먼트는 저휘도 인광 — docs/design/design-tokens.md §4 (primary-dim 35%)
              background:
                i < filled
                  ? "var(--color-primary)"
                  : "color-mix(in srgb, var(--color-primary-dim) 35%, transparent)",
              boxShadow: i < filled ? "var(--glow-primary)" : "none",
            }}
          />
        ))}
      </div>

      <p className="mt-2 font-mono text-2xl text-[var(--color-fg)]">
        {totals.debris.toLocaleString()}{" "}
        <span className="text-sm text-[var(--color-muted)]">
          {dict.firstScreen.pieces}
        </span>
      </p>
    </section>
  );
}
