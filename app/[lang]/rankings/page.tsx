import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMyRanking, getRankings } from "@/lib/rankings";
import { getMyJoop } from "@/lib/profile";
import { RankingList } from "@/components/ranking-list";

export const dynamic = "force-dynamic";

// 랭킹 자세히 보기 — 첫 화면의 5행 요약에서 넘어오는 전체 목록.
export default async function RankingsPage({ params }: PageProps<"/[lang]/rankings">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [dict, rows, myJoop] = await Promise.all([
    getDictionary(lang),
    getRankings(100),
    getMyJoop(),
  ]);
  const myRanking = myJoop ? await getMyRanking(myJoop.id) : null;

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)]"
      style={{ background: "var(--color-bg)" }}
    >
      <header className="mb-3 flex items-center justify-between">
        <Link href={`/${lang}`} className="font-mono text-xs text-[var(--color-muted)] underline">
          {dict.joop.back}
        </Link>
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {dict.rankings.title}
        </span>
      </header>

      {myRanking && (
        <p className="mb-3 text-center font-mono text-sm text-[var(--color-fg)]">
          {dict.rankings.mySummary
            .replace("{rank}", String(myRanking.rank))
            .replace("{points}", myRanking.totalCollected.toLocaleString())}
        </p>
      )}

      <RankingList rows={rows} dict={dict} lang={lang} myRanking={myRanking} compact={false} />

      <p className="mt-3 font-mono text-[10px] leading-relaxed text-[var(--color-muted)]">
        {dict.rankings.hint}
      </p>
    </main>
  );
}
