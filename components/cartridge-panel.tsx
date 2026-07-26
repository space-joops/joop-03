/**
 * 보급 카트리지 — docs/design/handoff-m2.md §3-5.
 * 폭 280 / padding 18 / radius 12(카트리지 전용 예외) + 코너 나사 도트 4개.
 * `screen` 은 내부 CRT 창(220px, 자체 주사선). 그 아래로 children(기기명·부팅 바·로그).
 */
export function CartridgePanel({
  screen,
  children,
}: {
  screen: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="relative w-[280px] max-w-full rounded-[12px] border-2 p-[18px]"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-neutral-700)",
        boxShadow:
          "inset 0 1px 0 var(--bezel-highlight), inset 0 -3px 8px var(--bezel-shadow)",
      }}
    >
      {[
        "left-2 top-2",
        "right-2 top-2",
        "left-2 bottom-2",
        "right-2 bottom-2",
      ].map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={`absolute ${pos} h-1.5 w-1.5 rounded-full`}
          style={{ background: "var(--color-neutral-600)", boxShadow: "inset 0 -1px 1px #000" }}
        />
      ))}

      <div
        className="scanlines relative grid h-[220px] place-items-center overflow-hidden rounded-[var(--radius-md)] border-2"
        style={{ background: "#071a0d", borderColor: "var(--color-neutral-700)" }}
      >
        {screen}
      </div>

      {children}
    </div>
  );
}
