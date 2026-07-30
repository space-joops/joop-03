import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LaunchReplay } from "@/components/launch-replay";
import { SoundToggle } from "@/components/sound-toggle";

// 발사 다시 보기 — 기록이 localStorage 에만 있으므로 서버 조회·가드가 없다.
// (launch/page.tsx 는 queued 전용 가드라 쿼리 방식 대신 전용 라우트로 분리)
export default async function LaunchReplayPage({
  params,
}: {
  // 신규 라우트 — 생성형 PageProps 타입은 빌드 후에 갱신되므로 직접 타이핑
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main
      className="game-fullbleed mx-auto flex w-full max-w-md flex-1 flex-col pt-[calc(env(safe-area-inset-top)+1rem)]"
      style={{ background: "var(--color-bg)" }}
    >
      <header className="mb-2 flex items-center justify-center gap-2 px-4">
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {dict.joop.replayLaunch}
        </span>
        <SoundToggle dict={dict} />
      </header>
      <LaunchReplay lang={lang} dict={dict} />
    </main>
  );
}
