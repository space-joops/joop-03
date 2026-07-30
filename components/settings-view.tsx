import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import type { MyJoop } from "@/lib/profile";
import { LanguageSetting } from "@/components/language-setting";
import { BaseStationSetting } from "@/components/base-station-setting";
import { ReturnEarthButton } from "@/components/return-earth-button";

// 설정 화면 본문 — 언어/기지국/지구 복귀를 한곳에 모은다(기존에는 홈 헤더·내 줍스·
// 우주지도 화면에 흩어져 있었다).
export function SettingsView({
  lang,
  dict,
  mine,
}: {
  lang: Locale;
  dict: Dictionary;
  mine: MyJoop | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
        {dict.settings.title}
      </h1>

      <LanguageSetting current={lang} dict={dict} />
      <BaseStationSetting dict={dict} />

      {mine?.status === "orbit" && (
        <section
          className="crt-brackets px-3 py-2"
          style={{ "--bracket-color": "var(--color-neutral-600)" } as React.CSSProperties}
        >
          <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--color-secondary)]">
            {dict.settings.returnEarth.title}
          </h2>
          <ReturnEarthButton lang={lang} dict={dict} />
        </section>
      )}
    </div>
  );
}
