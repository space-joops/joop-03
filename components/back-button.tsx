import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// 단일 뒤로가기 버튼 — BottomNav(5개 아이콘 탭)와 달리 우주지도·인벤토리처럼
// 하단 네비를 넣지 않기로 한 화면에서, 뷰포트 하단에 고정된 단순 복귀 버튼만 둔다.
export function BackButton({ href, dict }: { href: string; dict: Dictionary }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-md justify-center border-t px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2"
      style={{ borderColor: "var(--color-neutral-700)", background: "var(--color-bg)" }}
    >
      <Link
        href={href}
        className="w-full rounded-md border py-2.5 text-center font-mono text-sm"
        style={{ borderColor: "var(--color-neutral-600)", color: "var(--color-fg)" }}
      >
        ← {dict.common.back}
      </Link>
    </div>
  );
}
