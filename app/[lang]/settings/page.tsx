import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMyJoop } from "@/lib/profile";
import { SettingsView } from "@/components/settings-view";
import { BottomNav, withLaunchOrMap } from "@/components/bottom-nav";
import packageJson from "../../../package.json";

export const dynamic = "force-dynamic";

// 신규 라우트 — 생성형 PageProps 타입은 빌드 후에 갱신되므로 직접 타이핑
// (app/[lang]/joop/launch/replay/page.tsx 관례를 따른다).
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // 온보딩 전(줍스 미분양) 사용자도 언어/기지국 설정은 써야 하므로 리다이렉트하지 않는다.
  const [dict, mine] = await Promise.all([getDictionary(lang), getMyJoop()]);

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)]"
      style={{ background: "var(--color-bg)" }}
    >
      <SettingsView lang={lang} dict={dict} mine={mine} version={packageJson.version} />
      <BottomNav
        lang={lang}
        dict={dict}
        items={withLaunchOrMap(["home", "inventory", "map", "settings"], mine?.status === "orbit")}
        active="settings"
      />
    </main>
  );
}
