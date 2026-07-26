import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMyJoop } from "@/lib/profile";
import { getSpaceConfig } from "@/lib/space";
import { LaunchSequence } from "@/components/launch-sequence";

export const dynamic = "force-dynamic";

export default async function LaunchSeqPage({ params }: PageProps<"/[lang]/joop/launch">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const mine = await getMyJoop();
  if (!mine) redirect(`/${lang}/onboarding`);
  if (mine.status === "orbit") redirect(`/${lang}/joop/map`);
  if (mine.status !== "queued") redirect(`/${lang}/joop`); // 발사 자격 없음

  const [dict, cfg] = await Promise.all([getDictionary(lang), getSpaceConfig()]);

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)]"
      style={{ background: "var(--color-bg)" }}
    >
      <header className="mb-2 flex items-center justify-between px-4">
        <Link href={`/${lang}/joop`} className="font-mono text-xs text-[var(--color-muted)] underline">
          {dict.joop.back}
        </Link>
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {dict.launch.launchTitle}
        </span>
      </header>

      <LaunchSequence
        lang={lang}
        dict={dict}
        color={mine.color}
        countdownSeconds={cfg.launchCountdownSeconds}
      />
    </main>
  );
}
