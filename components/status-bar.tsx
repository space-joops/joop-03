// 단말기 상단 장식 상태바 — 이슈 #5 CRT 컨셉 (앰버 위계).
// 신호/배터리 글리프 + 상단 안전영역 패딩. 순수 장식이라 aria-hidden,
// 문구도 i18n 하지 않는다.
export function StatusBar() {
  return (
    <div
      aria-hidden
      className="flex items-center justify-between px-4 py-1.5 font-mono text-[10px] tracking-widest text-[var(--color-secondary)]"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 0.375rem)",
        borderBottom: "1px solid color-mix(in srgb, var(--color-secondary) 45%, transparent)",
      }}
    >
      <span>▚▚▚</span>
      <span>▮▮▮▯</span>
    </div>
  );
}
