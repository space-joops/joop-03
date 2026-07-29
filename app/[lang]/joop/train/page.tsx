import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMyJoop } from "@/lib/profile";
import { getMinigameConfig } from "@/lib/game-config";
import { GroundMinigame } from "@/components/ground-minigame";
import { SoundToggle } from "@/components/sound-toggle";

export const dynamic = "force-dynamic";

export default async function TrainPage({ params }: PageProps<"/[lang]/joop/train">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const mine = await getMyJoop();
  if (!mine) redirect(`/${lang}/onboarding`);

  // force-dynamic 이라 화면에 들어올 때마다 최신 설정을 읽는다 = "게임 재시작 시 반영".
  const [dict, minigameConfig] = await Promise.all([getDictionary(lang), getMinigameConfig()]);

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)]"
      style={{ background: "var(--color-bg)" }}
    >
      <header className="mb-2 flex items-center justify-between px-4">
        <Link href={`/${lang}/joop`} className="font-mono text-xs text-[var(--color-muted)] underline">
          {dict.joop.back}
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
            {dict.minigame.title}
          </span>
          <SoundToggle dict={dict} />
        </div>
      </header>

      {/* 조작 설명은 게임 안의 시작 브리핑에서 보여준다 — 화면 높이를 게임에 최대한 넘긴다. */}

      <GroundMinigame lang={lang} dict={dict} color={mine.color} config={minigameConfig} />
    </main>
  );
}
