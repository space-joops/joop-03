import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { JoopSprite } from "@/components/joop-sprite";
import { ReplayLaunchButton } from "@/components/replay-launch-button";
import { BottomNav, withLaunchOrMap } from "@/components/bottom-nav";
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
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-24 pt-[calc(env(safe-area-inset-top)+1.5rem)]"
      style={{ background: "var(--color-bg)" }}
    >
      <header className="mb-6 flex items-center justify-center">
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {j.title}
        </span>
      </header>

      {/* 줍스 카드 — 큰 픽셀 초상(UX 리뷰: "내 줍스를 크고 상세하게") */}
      <section
        className="rounded-lg border p-5"
        style={{ borderColor: "var(--color-neutral-600)", background: "var(--color-surface)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="crt-brackets p-4"
            style={{ "--bracket-color": mine.color } as React.CSSProperties}
          >
            {/* 시트 프레임 원본이 128px — 업스케일 없이 선명하다 */}
            <JoopSprite color={mine.color} size={128} className="pixelated" />
          </div>
          <div className="flex w-full min-w-0 items-center justify-center gap-2">
            {/* 색 점은 궤도/랭킹 도트와의 인지 연결용으로 유지 */}
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: mine.color, boxShadow: `0 0 8px ${mine.color}` }}
              aria-hidden
            />
            <span className="min-w-0 truncate font-mono text-lg font-semibold text-[var(--color-fg)]">
              {mine.name}
            </span>
            <span className="shrink-0 font-mono text-xs text-[var(--color-muted)]">
              {statusLabel}
            </span>
          </div>
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

      {/* 액션 — 줍스 상태별 분기 */}
      <div className="mt-5 flex flex-col gap-3">
        {/* SF 브래킷 프레임 버튼(UX 리뷰) — 주 액션은 primary 브래킷, 보조는 muted */}
        {mine.status === "orbit" ? (
          <>
            {/* 진입 단축(UX): 지도 경유 없이 아케이드 직행 — 서버 가드가 상태를 재검증한다 */}
            <Link
              href={`/${lang}/joop/arcade`}
              className="crt-brackets btn-brackets"
              style={{ "--bracket-color": "var(--color-primary)", color: "var(--color-primary)" } as React.CSSProperties}
            >
              {j.arcadeNow}
            </Link>
            <Link
              href={`/${lang}/joop/map`}
              className="crt-brackets btn-brackets"
              style={{ "--bracket-color": "var(--color-neutral-600)" } as React.CSSProperties}
            >
              {j.openMap}
            </Link>
            <ReplayLaunchButton lang={lang} dict={dict} />
          </>
        ) : mine.status === "queued" ? (
          <Link
            href={`/${lang}/joop/launch`}
            className="crt-brackets btn-brackets"
            style={{ "--bracket-color": "var(--color-primary)", color: "var(--color-primary)" } as React.CSSProperties}
          >
            {j.launchNow}
          </Link>
        ) : (
          // "발사 청약"(→ /launch)은 하단 네비 launch 탭과 목적지가 같아 중복이라 제거
          <Link
            href={`/${lang}/joop/train`}
            className="crt-brackets btn-brackets"
            style={{ "--bracket-color": "var(--color-primary)", color: "var(--color-primary)" } as React.CSSProperties}
          >
            {j.train}
          </Link>
        )}
      </div>

      <p className="mt-4 font-mono text-xs leading-relaxed text-[var(--color-muted)]">
        {mine.status === "orbit" ? j.hintOrbit : mine.status === "queued" ? j.hintQueued : j.hint}
      </p>

      <BottomNav
        lang={lang}
        dict={dict}
        items={withLaunchOrMap(["home", "myJoop", "inventory", "map", "settings"], mine.status === "orbit")}
        active="myJoop"
      />
    </main>
  );
}
