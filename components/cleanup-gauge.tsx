import type { Dictionary } from "@/lib/i18n/dictionaries";

// 누적 청소량 게이지 — 이슈 #5 CRT 컨셉의 앰버 진행바.
// 앰버 헤더 "라벨 [ NN% ]" + 연속 채움 바(인바 라벨) + 마일스톤 ▲ 틱 마커.
export function CleanupGauge({
  totals,
  dict,
}: {
  totals: { debris: number; percent: number };
  dict: Dictionary;
}) {
  const percent = Math.min(100, Math.max(0, totals.percent));
  // 채움 폭이 좁으면 인바 라벨이 넘치므로 바 밖(앰버)으로 뺀다.
  const labelInside = percent >= 40;
  const milestones = [25, 50, 75];

  return (
    <section className="px-4 py-1.5">
      <div
        className="crt-brackets px-3 py-2"
        style={
          {
            "--bracket-color": "color-mix(in srgb, var(--color-secondary) 60%, transparent)",
          } as React.CSSProperties
        }
      >
        <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-widest text-[var(--color-secondary)]">
          <span>{dict.firstScreen.totalCollected}</span>
          <span style={{ textShadow: "var(--glow-secondary)" }}>
            [ {percent.toFixed(1)}% ]
          </span>
        </div>

        <div
          className="relative mt-1 h-5 overflow-hidden rounded-[2px]"
          style={{
            background: "var(--color-surface)",
            border: "1px solid color-mix(in srgb, var(--color-secondary) 45%, transparent)",
          }}
          aria-hidden
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${percent}%`,
              background: "var(--color-secondary)",
              boxShadow: "var(--glow-secondary)",
            }}
          />
          <span
            className="absolute inset-y-0 flex items-center px-2 font-mono text-[10px] uppercase tracking-widest"
            style={
              labelInside
                ? { left: 0, color: "var(--color-bg)" }
                : { left: `${percent}%`, color: "var(--color-secondary)" }
            }
          >
            {dict.firstScreen.percentCleaned}
          </span>
        </div>

        {/* 마일스톤 ▲ 틱 마커 (25/50/75%) */}
        <div className="relative mt-0.5 h-3.5" aria-hidden>
          {milestones.map((m) => (
            <span
              key={m}
              className="absolute -translate-x-1/2 font-mono text-[10px] text-[var(--color-secondary)]"
              style={{ left: `${m}%`, opacity: percent >= m ? 1 : 0.45 }}
            >
              ▲{m}%
            </span>
          ))}
        </div>

        <p className="font-mono text-lg leading-6 text-[var(--color-secondary)]" style={{ textShadow: "var(--glow-secondary)" }}>
          {totals.debris.toLocaleString()}{" "}
          <span className="text-sm text-[var(--color-muted)]" style={{ textShadow: "none" }}>
            {dict.firstScreen.pieces}
          </span>
        </p>
      </div>
    </section>
  );
}
