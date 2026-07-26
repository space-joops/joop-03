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
            className="h-3 flex-1 rounded-[1px]"
            style={{
              background:
                i < filled ? "var(--color-primary)" : "var(--color-surface)",
              boxShadow: i < filled ? "0 0 6px var(--color-primary)" : "none",
              opacity: i < filled ? 1 : 0.5,
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
