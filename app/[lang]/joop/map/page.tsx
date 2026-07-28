import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMyOrbitState, getSpaceConfig, settleIdleCollection } from "@/lib/space";
import { getMyJoop } from "@/lib/profile";
import { getOrbitalSnapshot } from "@/lib/joops";
import { getArcadeShadowXpCost } from "@/lib/game-config";
import { OrbitViewer } from "@/components/orbit-viewer";
import { OrbitStatus } from "@/components/orbit-status";
import { LinkStatus } from "@/components/link-status";
import { ReturnEarthButton } from "@/components/return-earth-button";

export const dynamic = "force-dynamic";

export default async function MapPage({ params }: PageProps<"/[lang]/joop/map">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // 방문 시 idle 자동 수거 정산 → 그 다음 상태 조회
  const collected = await settleIdleCollection();
  const state = await getMyOrbitState();
  if (!state) redirect(`/${lang}/joop`); // 궤도 아님

  // 지구본·궤도 추적은 첫 화면과 **같은 컴포넌트·같은 게임 배속**을 쓴다(통일감).
  // 스냅샷은 궤도의 모든 줍스를 담으므로 이웃 줍스까지 함께 보인다.
  const [dict, snapshot, mine, shadowXpCost, spaceCfg] = await Promise.all([
    getDictionary(lang),
    getOrbitalSnapshot(),
    getMyJoop(),
    getArcadeShadowXpCost(),
    getSpaceConfig(),
  ]);

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

      <div
        className="crt-brackets my-3 px-3 py-2"
        style={{ "--bracket-color": "var(--color-primary)" } as React.CSSProperties}
      >
        <OrbitViewer
          snapshot={snapshot}
          myJoopId={state.id}
          myColor={state.color}
          gameSpeed={state.gameSpeed}
          shadowFraction={spaceCfg.shadowFraction}
          lang={lang}
          dict={dict}
          layout="stack"
        />
      </div>

      {collected > 0 && (
        <p className="mb-3 text-center font-mono text-xs text-[var(--color-primary)]">
          {dict.space.collectedWhileAway.replace("{n}", collected.toLocaleString())}
        </p>
      )}

      <LinkStatus
        state={state}
        dict={dict}
        lang={lang}
        shadowXpCost={shadowXpCost}
        myXp={mine?.xp ?? 0}
      />

      {/* 운용 상태 — 접이식(UX 리뷰: 데이터보다 시각 경로에 집중). 세부 지표·안내문은
          여기로 흡수해 화면의 동일 무게 패널 반복을 줄인다. JS 없는 details/summary. */}
      <details className="panel-amber mt-3 px-3 py-2">
        <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-widest text-[var(--color-secondary)]">
          {dict.space.operationStatus} ▾
        </summary>
        <div className="mt-2">
          <OrbitStatus state={state} dict={dict} />
        </div>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-[var(--color-muted)]">
          {dict.space.passInfo.replace("{speed}", String(state.gameSpeed))}
        </p>
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-[var(--color-muted)]">
          {dict.space.hint}
        </p>
      </details>

      {/* 지구 복귀 — 발사 루프를 처음부터 다시(수거량·XP 유지) */}
      <ReturnEarthButton lang={lang} dict={dict} />
    </main>
  );
}
