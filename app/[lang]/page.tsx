import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getOrbitalSnapshot } from "@/lib/joops";
import { getMyRanking, getRankings } from "@/lib/rankings";
import { getMyJoop } from "@/lib/profile";
import { getSpaceConfig } from "@/lib/space";
import { FirstScreen } from "@/components/first-screen-client";

// 초기 스냅샷은 매 요청 신선하게(Date.now 기반 + Supabase 조회). 렌더 갱신은 클라 폴링이 담당.
export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // 랭킹은 5행으로 눌러 하단 CTA까지 한 화면에 들어가게 한다(내 순위는 별도 고정 행).
  const [dict, snapshot, rankings, myJoop, spaceCfg] = await Promise.all([
    getDictionary(lang),
    getOrbitalSnapshot(),
    getRankings(5),
    getMyJoop(),
    getSpaceConfig(),
  ]);
  const myRanking = myJoop ? await getMyRanking(myJoop.id) : null;

  return (
    <FirstScreen
      lang={lang}
      dict={dict}
      initialSnapshot={snapshot}
      rankings={rankings}
      myRanking={myRanking}
      myJoop={myJoop}
      gameSpeed={spaceCfg.orbitGameSpeed}
      shadowFraction={spaceCfg.shadowFraction}
    />
  );
}
