import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMyJoop } from "@/lib/profile";
import { getMyOrbitState } from "@/lib/space";
import { getArcadeConfig, getArcadeShadowXpCost } from "@/lib/game-config";
import { ArcadeGame } from "@/components/arcade-game";

export const dynamic = "force-dynamic";

// 아케이드(우주 수거, M5) — 궤도의 줍스가 수신 지역(음영 아님)일 때 진입한다(FR-6.6).
// 가드는 발사 시퀀스 페이지의 3단 리다이렉트 패턴을 따른다.
export default async function ArcadePage({ params }: PageProps<"/[lang]/joop/arcade">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const mine = await getMyJoop();
  if (!mine) redirect(`/${lang}/onboarding`);
  if (mine.status !== "orbit") redirect(`/${lang}/joop`); // 궤도 아니면 대시보드로

  const [state, shadowXpCost] = await Promise.all([
    getMyOrbitState(),
    getArcadeShadowXpCost(),
  ]);
  if (!state) redirect(`/${lang}/joop`);

  // ⚠️ 음영이어도 리다이렉트하지 않는다(초기 개발 단계). 대신 게임 시작 오버레이에서
  //    XP 를 지불하거나 수신 복귀를 기다리게 한다 — 결제·재판정은 서버 액션이 담당.
  // force-dynamic 이라 진입할 때마다 최신 설정 = "게임 재시작 시 반영"(FR-10.2)
  const [dict, config] = await Promise.all([getDictionary(lang), getArcadeConfig()]);

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)]"
      style={{ background: "var(--color-bg)" }}
    >
      <header className="mb-2 flex items-center justify-between px-4">
        <Link
          href={`/${lang}/joop/map`}
          className="font-mono text-xs text-[var(--color-muted)] underline"
        >
          {dict.arcade.toMap}
        </Link>
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {dict.arcade.title}
        </span>
      </header>

      <ArcadeGame
        lang={lang}
        dict={dict}
        color={mine.color}
        name={mine.name}
        config={config}
        shadowGate={{
          inShadow: state.inShadow,
          cost: shadowXpCost,
          xp: mine.xp,
          nextChangeAt: state.nextChangeAt,
          serverNow: state.serverTime,
        }}
      />
    </main>
  );
}
