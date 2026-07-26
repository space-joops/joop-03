import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getOrbitalSnapshot } from "@/lib/joops";
import { getRankings } from "@/lib/rankings";
import { FirstScreen } from "@/components/first-screen-client";

// 초기 스냅샷은 매 요청 신선하게(Date.now 기반 + Supabase 조회). 렌더 갱신은 클라 폴링이 담당.
export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [dict, snapshot, rankings] = await Promise.all([
    getDictionary(lang),
    getOrbitalSnapshot(),
    getRankings(10),
  ]);

  return (
    <FirstScreen
      lang={lang}
      dict={dict}
      initialSnapshot={snapshot}
      rankings={rankings}
    />
  );
}
