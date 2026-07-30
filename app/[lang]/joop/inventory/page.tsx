import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { InventoryView } from "@/components/inventory-view";

// 인벤토리 — 수집 쓰레기·도킹 위성·초대코드가 전부 localStorage 라 서버 조회·가드가 없다.
// (일반 스크롤 화면이라 game-fullbleed 는 쓰지 않는다 — 버전 배지 유지)
export default async function InventoryPage({
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
      className="mx-auto flex w-full max-w-md flex-1 flex-col pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)]"
      style={{ background: "var(--color-bg)" }}
    >
      <header className="mb-2 flex items-center justify-center px-4">
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {dict.inventory.title}
        </span>
      </header>
      <InventoryView lang={lang} dict={dict} />
    </main>
  );
}
