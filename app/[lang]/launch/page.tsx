import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMyJoop } from "@/lib/profile";
import { getLaunchVehicles } from "@/lib/launch";
import { LaunchList } from "@/components/launch-list";

export const dynamic = "force-dynamic";

export default async function LaunchPage({ params }: PageProps<"/[lang]/launch">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const mine = await getMyJoop();
  if (!mine) redirect(`/${lang}/onboarding`);

  const [dict, vehicles] = await Promise.all([getDictionary(lang), getLaunchVehicles()]);

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-8"
      style={{ background: "var(--color-bg)" }}
    >
      <header className="mb-4 flex items-center justify-center">
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {dict.launch.title}
        </span>
      </header>

      <p className="mb-4 font-mono text-xs leading-relaxed text-[var(--color-muted)]">
        {dict.launch.subtitle.replace("{level}", String(mine.level))}
      </p>

      <LaunchList lang={lang} dict={dict} vehicles={vehicles} myLevel={mine.level} />
    </main>
  );
}
