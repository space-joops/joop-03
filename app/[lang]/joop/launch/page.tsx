import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMyJoop } from "@/lib/profile";
import { getSpaceConfig } from "@/lib/space";
import { getMyConfirmedVehicle } from "@/lib/launch";
import { LaunchSequence } from "@/components/launch-sequence";
import { SoundToggle } from "@/components/sound-toggle";

export const dynamic = "force-dynamic";

export default async function LaunchSeqPage({ params }: PageProps<"/[lang]/joop/launch">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const mine = await getMyJoop();
  if (!mine) redirect(`/${lang}/onboarding`);
  if (mine.status === "orbit") redirect(`/${lang}/joop/map`);
  if (mine.status !== "queued") redirect(`/${lang}/joop`); // 발사 자격 없음

  // 내가 청약해 확정된 발사체 — 미션 행(발사체·발사장)에 표시(핸드오프 m4 §3)
  const [dict, cfg, vehicle] = await Promise.all([
    getDictionary(lang),
    getSpaceConfig(),
    getMyConfirmedVehicle(),
  ]);

  return (
    // 풀블리드 중계 화면 — 텔레메트리 바가 safe-area 하단을 자체 처리한다
    <main
      className="game-fullbleed mx-auto flex w-full max-w-md flex-1 flex-col pt-[calc(env(safe-area-inset-top)+1rem)]"
      style={{ background: "var(--color-bg)" }}
    >
      <header className="mb-2 flex items-center justify-between px-4">
        <Link href={`/${lang}/joop`} className="font-mono text-xs text-[var(--color-muted)] underline">
          {dict.joop.back}
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
            {dict.launch.launchTitle}
          </span>
          <SoundToggle dict={dict} />
        </div>
      </header>

      <LaunchSequence
        lang={lang}
        dict={dict}
        color={mine.color}
        countdownSeconds={cfg.launchCountdownSeconds}
        sequenceSeconds={cfg.launchSequenceSeconds}
        vehicle={vehicle}
      />
    </main>
  );
}
