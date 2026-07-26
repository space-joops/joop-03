/**
 * 온보딩 공용 셸 — docs/design/handoff-m2.md §3(상단바·페이지 여백·safe area).
 * 상단바: 뒤로(44×44) · 타이틀 · STEP n/3. `back` 이 없으면 44px 스페이서를 두고
 * 타이틀을 중앙 정렬한다(시안 ② 분양 연출은 뒤로가기가 없다).
 */
export function OnboardingShell({
  title,
  step,
  stepLabel,
  back,
  children,
}: {
  title: string;
  step: 1 | 2 | 3;
  /** 이미 보간된 문자열 — 예: "STEP 2/3" */
  stepLabel: string;
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <main
      className="scanlines relative mx-auto flex w-full max-w-[var(--content-max)] flex-1 flex-col"
      style={{ background: "var(--color-bg)" }}
    >
      <header
        className="flex flex-none items-center gap-1.5 px-2"
        style={{ height: "calc(56px + var(--safe-top))", paddingTop: "var(--safe-top)" }}
      >
        {back ? (
          <a
            href={back.href}
            aria-label={back.label}
            className="grid h-11 w-11 place-items-center text-[var(--color-muted)]"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="square"
              aria-hidden
            >
              <path d="M15 4 L7 12 L15 20" />
            </svg>
          </a>
        ) : (
          <span className="w-11" aria-hidden />
        )}
        <h1
          className={`text-[17px] font-semibold leading-6${back ? "" : " mx-auto"}`}
          style={{ color: "var(--color-fg)" }}
        >
          {title}
        </h1>
        <span
          className="ml-auto pr-3 font-mono text-xs leading-4 tracking-[0.08em] text-[var(--color-muted)]"
          aria-label={`${step}/3`}
        >
          {stepLabel}
        </span>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col pt-2"
        style={{ paddingLeft: "var(--page-pad-x)", paddingRight: "var(--page-pad-x)" }}
      >
        {children}
      </div>
    </main>
  );
}
