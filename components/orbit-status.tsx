import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { OrbitState } from "@/lib/space";

// 궤도 상태 지표 (속도·고도·상공·음영/수신).
export function OrbitStatus({ state, dict }: { state: OrbitState; dict: Dictionary }) {
  const t = dict.space;

  const latH = `${Math.abs(state.latitude)}°${state.latitude >= 0 ? "N" : "S"}`;
  const lonH = `${Math.abs(state.longitude)}°${state.longitude >= 0 ? "E" : "W"}`;

  const cell = (label: string, value: string) => (
    <div
      className="flex flex-col gap-1 rounded-md border p-3"
      style={{ borderColor: "var(--color-neutral-600)", background: "var(--color-surface)" }}
    >
      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
        {label}
      </span>
      <span className="font-mono text-sm text-[var(--color-fg)]">{value}</span>
    </div>
  );

  // 라벨 앞 글리프 — 텍스트를 아이콘화(UX 리뷰), 라벨 자체는 유지(접근성)
  return (
    <div className="grid grid-cols-2 gap-2">
      {cell(`▲ ${t.altitude}`, `${state.altitudeKm.toLocaleString()} km`)}
      {cell(`➤ ${t.speed}`, `${state.speedKms} km/s`)}
      {cell(`◎ ${t.overhead}`, `${latH} ${lonH}`)}
      <div
        className="flex flex-col gap-1 rounded-md border p-3"
        style={{
          borderColor: state.inShadow ? "var(--color-neutral-600)" : "var(--color-primary)",
          background: "var(--color-surface)",
        }}
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
          ⇄ {t.link}
        </span>
        <span
          className="font-mono text-sm"
          style={{ color: state.inShadow ? "var(--color-secondary)" : "var(--color-primary)" }}
        >
          {state.inShadow ? "◐ " : "● "}
          {state.inShadow ? t.shadowAuto : t.linkActive}
        </span>
      </div>
    </div>
  );
}
