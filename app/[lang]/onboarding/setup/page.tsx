import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { createSessionClient } from "@/lib/supabase/session";
import { SetupForm } from "@/components/setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage({ params }: PageProps<"/[lang]/onboarding/setup">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // 세션(익명 포함)이 없으면 온보딩 시작으로
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/onboarding`);

  const dict = await getDictionary(lang);

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[calc(env(safe-area-inset-top)+2rem)] pb-8"
      style={{ background: "var(--color-bg)" }}
    >
      <h1 className="mb-6 font-mono text-xl font-semibold tracking-[0.15em] text-[var(--color-primary)]">
        {dict.onboarding.setup.title}
      </h1>
      <SetupForm lang={lang} dict={dict} />
    </main>
  );
}
