import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { createSessionClient } from "@/lib/supabase/session";
import { deviceNameFor } from "@/lib/joop-device-name";
import { OnboardingShell } from "@/components/onboarding-shell";
import { BootSequence } from "@/components/boot-sequence";

export const dynamic = "force-dynamic";

// ② 분양 연출 (FR-2.2) — 보급 카트리지 부팅. 시안: docs/design/mockups/onboarding.html
// 연출 화면이라 뒤로가기를 두지 않는다(핸드오프 §1).
export default async function BootPage({ params }: PageProps<"/[lang]/onboarding/boot">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // 세션(익명 포함)이 없으면 온보딩 시작으로
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/onboarding`);

  const dict = await getDictionary(lang);
  const t = dict.onboarding;

  return (
    <OnboardingShell
      title={t.boot.title}
      step={2}
      stepLabel={t.stepIndicator.replace("{n}", "2")}
    >
      <BootSequence lang={lang} dict={dict} deviceName={deviceNameFor(user.id)} />
    </OnboardingShell>
  );
}
