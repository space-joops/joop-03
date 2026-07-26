import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMyJoop } from "@/lib/profile";
import { OnboardingForm } from "@/components/onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ params }: PageProps<"/[lang]/onboarding">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // 이미 분양받았으면 첫 화면으로
  const mine = await getMyJoop();
  if (mine) redirect(`/${lang}`);

  const dict = await getDictionary(lang);

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[calc(env(safe-area-inset-top)+2rem)] pb-8"
      style={{ background: "var(--color-bg)" }}
    >
      <h1 className="font-mono text-xl font-semibold tracking-[0.15em] text-[var(--color-primary)]">
        {dict.onboarding.title}
      </h1>
      <p className="mb-6 mt-2 font-mono text-sm leading-relaxed text-[var(--color-muted)]">
        {dict.onboarding.subtitle}
      </p>
      <OnboardingForm lang={lang} dict={dict} />
    </main>
  );
}
