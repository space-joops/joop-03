import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMyOrbitState, settleIdleCollection } from "@/lib/space";
import { SpaceMap } from "@/components/space-map";
import { OrbitStatus } from "@/components/orbit-status";

export const dynamic = "force-dynamic";

export default async function MapPage({ params }: PageProps<"/[lang]/joop/map">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // 방문 시 idle 자동 수거 정산 → 그 다음 상태 조회
  const collected = await settleIdleCollection();
  const state = await getMyOrbitState();
  if (!state) redirect(`/${lang}/joop`); // 궤도 아님

  const dict = await getDictionary(lang);

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)]"
      style={{ background: "var(--color-bg)" }}
    >
      <header className="mb-3 flex items-center justify-between">
        <Link href={`/${lang}/joop`} className="font-mono text-xs text-[var(--color-muted)] underline">
          {dict.joop.back}
        </Link>
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {dict.space.title}
        </span>
      </header>

      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: state.color, boxShadow: `0 0 8px ${state.color}` }}
          aria-hidden
        />
        <span className="font-mono text-base font-semibold text-[var(--color-fg)]">
          {state.name}
        </span>
      </div>

      <div className="my-3">
        <SpaceMap state={state} />
      </div>

      {collected > 0 && (
        <p className="mb-3 text-center font-mono text-xs text-[var(--color-primary)]">
          {dict.space.collectedWhileAway.replace("{n}", collected.toLocaleString())}
        </p>
      )}

      <OrbitStatus state={state} dict={dict} />

      <p className="mt-3 font-mono text-xs leading-relaxed text-[var(--color-muted)]">
        {dict.space.hint}
      </p>
    </main>
  );
}
