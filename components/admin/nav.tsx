"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { logoutAdmin } from "@/app/admin/actions";
import { btnGhostClass, btnGhostStyle } from "@/components/admin/ui";

const LINKS = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/config", label: "게임 설정" },
  { href: "/admin/launch", label: "발사체" },
  { href: "/admin/invites", label: "초대코드" },
  { href: "/admin/waitlist", label: "대기리스트" },
] as const;

export function AdminNav() {
  // 레이아웃은 재렌더되지 않으므로 현재 경로는 클라이언트 컴포넌트에서 읽는다(layout.md).
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <header
      className="border-b"
      style={{ borderColor: "var(--color-neutral-700)", background: "var(--color-surface)" }}
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
        <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          줍스 관리자
        </span>

        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {LINKS.map((link) => {
            const active =
              link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="font-mono text-xs uppercase tracking-widest"
                style={{ color: active ? "var(--color-fg)" : "var(--color-muted)" }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void logoutAdmin())}
          className={`ml-auto ${btnGhostClass}`}
          style={btnGhostStyle}
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
