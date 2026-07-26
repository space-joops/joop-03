import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMyJoop } from "@/lib/profile";
import { OnboardingShell } from "@/components/onboarding-shell";
import { OnboardingForm } from "@/components/onboarding-form";

export const dynamic = "force-dynamic";

// ① 초대코드 입력 (FR-2.1 / FR-2.2) — 시안: docs/design/mockups/onboarding.html
export default async function OnboardingPage({ params }: PageProps<"/[lang]/onboarding">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // 이미 분양받았으면 첫 화면으로
  const mine = await getMyJoop();
  if (mine) redirect(`/${lang}`);

  const dict = await getDictionary(lang);
  const t = dict.onboarding;

  return (
    <OnboardingShell
      title={t.invite.pageTitle}
      step={1}
      stepLabel={t.stepIndicator.replace("{n}", "1")}
      back={{ href: `/${lang}`, label: t.a11y.back }}
    >
      <p className="mb-1 text-xs uppercase leading-4 tracking-[0.08em] text-[var(--color-secondary)]">
        {t.invite.eyebrow}
      </p>
      <h2 className="mb-1.5 text-[22px] font-semibold leading-[30px]">{t.invite.title}</h2>
      <p className="mb-6 text-[15px] leading-[22px] text-[var(--color-muted)]">{t.invite.lead}</p>

      <OnboardingForm lang={lang} dict={dict} />
    </OnboardingShell>
  );
}
