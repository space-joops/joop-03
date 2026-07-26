import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { RankingRow } from "@/lib/rankings";
import { Sparkline } from "@/components/sparkline";

// 등락 = prevRank - rank (양수면 상승)
function ChangeIndicator({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="text-[var(--color-muted)]">–</span>;
  }
  const up = delta > 0;
  return (
    <span style={{ color: up ? "var(--color-success)" : "var(--color-danger)" }}>
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

export function RankingList({
  rows,
  dict,
}: {
  rows: RankingRow[];
  dict: Dictionary;
}) {
  // 상위 랭커의 주간 수거량으로 전체 주간 추세 스파크라인
  const weeklyTrend = rows.map((r) => r.collectedInWeek);

  return (
    <section className="px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {dict.firstScreen.ranking}
        </h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
            {dict.firstScreen.weeklyChange}
          </span>
          <Sparkline values={weeklyTrend} />
        </div>
      </div>

      <ol className="flex flex-col gap-1">
        {rows.map((r) => (
          <li
            key={r.joopId}
            className="flex items-center gap-3 rounded-sm px-2 py-1.5"
            style={{ background: "var(--color-surface)" }}
          >
            <span className="w-6 text-right font-mono text-sm text-[var(--color-muted)]">
              {r.rank}
            </span>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: r.color, boxShadow: `0 0 6px ${r.color}` }}
              aria-hidden
            />
            <span className="flex-1 truncate font-mono text-sm text-[var(--color-fg)]">
              {r.name}
            </span>
            <span className="font-mono text-xs text-[var(--color-muted)]">
              {r.totalCollected.toLocaleString()}
            </span>
            <span className="w-10 text-right font-mono text-xs">
              <ChangeIndicator delta={r.prevRank - r.rank} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
