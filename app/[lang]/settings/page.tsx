// 설정 화면 — 탭바(handoff-m6.md §4-3)의 '설정' 탭 목적지.
// 언어 스위처(FR-0.1, 기존 첫 화면 헤더에서 이전)와 버전 표시(구 version-badge, 장애대응/고객응대용)를 담는다.
import { notFound } from "next/navigation";
import packageJson from "@/package.json";
import { LanguageSwitcher } from "@/components/language-switcher";
import { TabBar } from "@/components/tab-bar";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: PageProps<"/[lang]/settings">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const t = dict.settings;

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+5.5rem)]"
      style={{ background: "var(--color-bg)" }}
    >
      <header className="mb-6">
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {t.title}
        </span>
      </header>

      <section
        className="flex items-center justify-between rounded-lg border p-4"
        style={{ borderColor: "var(--color-neutral-600)", background: "var(--color-surface)" }}
      >
        <span className="font-mono text-sm text-[var(--color-fg)]">{t.language}</span>
        <LanguageSwitcher current={lang} />
      </section>

      <section
        className="mt-3 flex items-center justify-between rounded-lg border p-4"
        style={{ borderColor: "var(--color-neutral-600)", background: "var(--color-surface)" }}
      >
        <span className="font-mono text-sm text-[var(--color-fg)]">{t.version}</span>
        <span className="font-mono text-xs text-[var(--color-muted)]">
          v{packageJson.version}
        </span>
      </section>

      <TabBar lang={lang} tab={dict.tab} active="settings" />
    </main>
  );
}
