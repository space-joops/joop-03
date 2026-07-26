import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ButtonLink } from "@/components/button";
import { TabBar } from "@/components/tab-bar";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMyJoop } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function JoopPage({ params }: PageProps<"/[lang]/joop">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const mine = await getMyJoop();
  if (!mine) redirect(`/${lang}/onboarding`);

  const dict = await getDictionary(lang);
  const j = dict.joop;
  const statusLabel = mine.status === "orbit" ? dict.home.orbit : dict.home.ground;

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+5.5rem)]"
      style={{ background: "var(--color-bg)" }}
    >
      <header className="mb-6 flex items-center justify-between">
        <Link href={`/${lang}`} className="font-mono text-xs text-[var(--color-muted)] underline">
          {j.back}
        </Link>
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {j.title}
        </span>
      </header>

      {/* 줍스 카드 */}
      <section
        className="rounded-lg border p-5"
        style={{ borderColor: "var(--color-neutral-600)", background: "var(--color-surface)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="h-4 w-4 rounded-full"
            style={{ background: mine.color, boxShadow: `0 0 8px ${mine.color}` }}
            aria-hidden
          />
          <span className="font-mono text-lg font-semibold text-[var(--color-fg)]">
            {mine.name}
          </span>
          <span className="ml-auto font-mono text-xs text-[var(--color-muted)]">
            {statusLabel}
          </span>
        </div>

        <div className="mt-4 flex items-baseline justify-between font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          <span>
            {dict.home.level} {mine.level}
          </span>
          <span>{mine.xpIntoLevel}/100 XP</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--color-neutral-700)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${mine.xpIntoLevel}%`,
              background: "var(--color-primary)",
              boxShadow: "var(--glow-primary)",
            }}
          />
        </div>
      </section>

      {/* 액션 */}
      <div className="mt-5 flex flex-col gap-3">
        <ButtonLink href={`/${lang}/joop/train`} variant="primary" className="w-full">
          {j.train}
        </ButtonLink>
        <ButtonLink href={`/${lang}/launch`} variant="secondary" className="w-full">
          {j.launch}
        </ButtonLink>
      </div>

      <p className="mt-4 font-mono text-xs leading-relaxed text-[var(--color-muted)]">
        {j.hint}
      </p>

      <TabBar lang={lang} tab={dict.tab} />
    </main>
  );
}
