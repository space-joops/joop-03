import type { Dictionary } from "@/lib/i18n/dictionaries";

// 누적 청소량 게이지 — 이슈 #5 CRT 컨셉의 앰버 진행바.
// 앰버 헤더 "라벨 [ NN% ]" + 연속 채움 바(인바 라벨) + 마일스톤 ▲ 틱 마커.
export function CleanupGauge({
  totals,
  dict,
}: {
  totals: { debris: number; percent: number; target?: number };
  dict: Dictionary;
}) {
  const percent = Math.min(100, Math.max(0, totals.percent));
  // 채움 폭이 좁으면 인바 라벨이 넘치므로 바 밖(앰버)으로 뺀다.
  const labelInside = percent >= 40;
  const milestones = [25, 50, 75];

  return (
    <section className="px-4 py-1">
      <div
        className="crt-brackets px-3 py-1.5"
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
          className="relative mt-1 h-4 overflow-hidden rounded-[2px]"
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
        <div className="relative mt-0.5 h-3" aria-hidden>
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

        {/* 수치 행 — 쓰레기 봉투(채움 = percent, 서버 렌더) + 대형 숫자 + 목표 대비 (UX 리뷰) */}
        <div className="flex items-center gap-2">
          <svg width="18" height="21" viewBox="0 0 22 26" aria-hidden className="shrink-0">
            {/* 봉투 외곽 + percent 만큼 아래에서 차오르는 채움 */}
            <path
              d="M7 5 L7 2.5 L15 2.5 L15 5 L19 8 L19 22.5 a1.5 1.5 0 0 1 -1.5 1.5 L4.5 24 A1.5 1.5 0 0 1 3 22.5 L3 8 Z"
              fill="var(--color-surface)"
              stroke="var(--color-secondary)"
              strokeWidth="1.4"
            />
            <clipPath id="bagclip">
              <path d="M7 5 L7 2.5 L15 2.5 L15 5 L19 8 L19 22.5 a1.5 1.5 0 0 1 -1.5 1.5 L4.5 24 A1.5 1.5 0 0 1 3 22.5 L3 8 Z" />
            </clipPath>
            <rect
              x="0"
              y={24 - (19 * Math.max(4, percent)) / 100}
              width="22"
              height={(19 * Math.max(4, percent)) / 100 + 2}
              fill="var(--color-secondary)"
              opacity="0.85"
              clipPath="url(#bagclip)"
            />
          </svg>
          <p
            className="font-mono text-2xl font-semibold leading-6 text-[var(--color-secondary)]"
            style={{ textShadow: "var(--glow-secondary)" }}
          >
            {totals.debris.toLocaleString()}{" "}
            <span className="text-sm font-normal text-[var(--color-muted)]" style={{ textShadow: "none" }}>
              {dict.firstScreen.pieces}
              {totals.target ? ` / ${totals.target.toLocaleString()}` : ""}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
