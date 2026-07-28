import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import type { RankingRow } from "@/lib/rankings";
import { DebrisKindIcons } from "@/components/debris-kind-icons";

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

function RankRow({
  r,
  dict,
  mine,
  compact,
}: {
  r: RankingRow;
  dict: Dictionary;
  /** 내 줍스 행 — 액센트 테두리 + "나" 배지로 강조 */
  mine: boolean;
  compact: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-2 ${compact ? "py-0.5" : "py-1.5"} ${
        mine ? "rounded-sm border px-1" : ""
      }`}
      style={mine ? { borderColor: "var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 8%, transparent)" } : undefined}
    >
      <span className="w-6 shrink-0 text-right font-mono text-xs text-[var(--color-muted)]">
        {r.rank}.
      </span>
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: r.color, boxShadow: `0 0 6px ${r.color}` }}
        aria-hidden
      />
      <span className="flex-1 truncate font-mono text-xs text-[var(--color-fg)]">
        {r.name}
        {mine && (
          <span className="ml-1.5 rounded-sm px-1 font-mono text-[9px] uppercase tracking-widest"
            style={{ background: "var(--color-primary)", color: "var(--color-bg)" }}>
            {dict.firstScreen.myRank}
          </span>
        )}
      </span>
      {/* 수거 종류(기여도) 아이콘 — 내 행은 로컬 실데이터, 타인 행은 결정적 장식 */}
      <DebrisKindIcons joopId={r.joopId} mine={mine} count={compact ? 2 : 3} size={compact ? 12 : 14} />
      <span className="font-mono text-xs text-[var(--color-secondary)]">
        {r.totalCollected.toLocaleString()} {dict.firstScreen.pointsUnit}
      </span>
      <span className="w-10 shrink-0 text-right font-mono text-xs">
        <ChangeIndicator delta={r.prevRank - r.rank} />
      </span>
    </li>
  );
}

// 랭킹 — 이슈 #5 CRT 컨셉의 터미널 테이블: 앰버 헤더/보더, 카드 배경 없는 행,
// 이름은 fg(그린 위계), 포인트는 앰버.
// compact(첫 화면): 행 py-0.5·text-xs 로 눌러 하단 CTA까지 한 화면에 들어가게 한다.
// myRanking: 내 순위 — 목록 안에 있으면 그 행을 강조, 밖이면 "⋯" 아래 고정 행으로 붙인다.
export function RankingList({
  rows,
  dict,
  lang,
  myRanking = null,
  compact = true,
  showMore = false,
}: {
  rows: RankingRow[];
  dict: Dictionary;
  lang: Locale;
  myRanking?: RankingRow | null;
  compact?: boolean;
  /** 헤더 우측 "자세히 →" 링크(첫 화면 → /rankings) */
  showMore?: boolean;
}) {
  const myInList = !!myRanking && rows.some((r) => r.joopId === myRanking.joopId);

  return (
    <section className={compact ? "px-4 py-1" : ""}>
      <div className={`panel-amber px-3 ${compact ? "py-1.5" : "py-2"}`}>
        <div
          className="mb-1 flex items-center justify-between pb-1.5"
          style={{
            borderBottom: "1px solid color-mix(in srgb, var(--color-secondary) 45%, transparent)",
          }}
        >
          <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--color-secondary)]">
            {dict.firstScreen.ranking}
          </h2>
          {/* 스파크라인 제거(2026-07-28) — 입력이 시계열이 아니라 순위순 나열이라
              항상 우하향하는 거짓 신호였다. 실제 일별 집계 뷰가 생기면 재도입. */}
          <div className="flex items-center gap-2">
            {showMore && (
              <Link
                href={`/${lang}/rankings`}
                className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg)] underline underline-offset-2"
              >
                {dict.firstScreen.rankingMore} →
              </Link>
            )}
          </div>
        </div>

        <ol className="flex flex-col">
          {rows.map((r) => (
            <RankRow
              key={r.joopId}
              r={r}
              dict={dict}
              mine={!!myRanking && r.joopId === myRanking.joopId}
              compact={compact}
            />
          ))}
          {/* 내 순위가 표시 범위 밖이면 아래에 고정 행으로 — "첫 화면에서 내 랭킹 확인" */}
          {myRanking && !myInList && (
            <>
              <li aria-hidden className="py-0 text-center font-mono text-[10px] leading-3 text-[var(--color-muted)]">
                ⋯
              </li>
              <RankRow r={myRanking} dict={dict} mine compact={compact} />
            </>
          )}
        </ol>
      </div>
    </section>
  );
}
