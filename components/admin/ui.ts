// 관리자 화면 공통 클래스/스타일 상수.
//
// 게임 컴포넌트는 클래스 문자열을 파일마다 복붙하는 관행이지만, 관리자 화면은 6개 화면이
// 같은 패널·표·폼을 반복하므로 여기 모은다. 컴포넌트 라이브러리가 아니라 순수 상수 모음이라
// 클라/서버 어디서든 import 해도 안전하다. 색은 전부 app/globals.css 의 기존 토큰만 쓴다.

export const panelClass = "rounded-lg border p-5";
export const panelStyle = {
  borderColor: "var(--color-neutral-600)",
  background: "var(--color-surface)",
} as const;

export const labelClass =
  "font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]";

export const inputClass =
  "w-full rounded-md border px-3 py-2 font-mono text-sm text-[var(--color-fg)] outline-none";
export const inputStyle = {
  background: "var(--color-bg)",
  borderColor: "var(--color-neutral-600)",
} as const;

export const btnPrimaryClass =
  "rounded-md px-4 py-2 font-mono text-xs font-semibold uppercase tracking-widest disabled:opacity-60";
export const btnPrimaryStyle = {
  background: "var(--color-primary)",
  color: "var(--color-bg)",
} as const;

export const btnGhostClass =
  "rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-[var(--color-fg)] disabled:opacity-60";
export const btnGhostStyle = { borderColor: "var(--color-neutral-600)" } as const;
export const btnDangerStyle = {
  borderColor: "var(--color-danger)",
  color: "var(--color-danger)",
} as const;

// 관리자 목록은 진짜 2차원 표 데이터라 <table> 을 쓴다(게임 화면은 계속 <ul>).
// 열 정렬과 스크린리더의 헤더-셀 관계를 <ul> 로는 만들 수 없다.
export const tableClass = "w-full border-collapse";
export const thClass =
  "border-b px-3 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]";
export const tdClass = "border-b px-3 py-2.5 font-mono text-xs text-[var(--color-fg)] align-middle";
export const cellBorderStyle = { borderColor: "var(--color-neutral-700)" } as const;

export const errorTextClass = "font-mono text-xs text-[var(--color-danger)]";
export const okTextClass = "font-mono text-xs text-[var(--color-primary)]";
export const mutedTextClass = "font-mono text-xs text-[var(--color-muted)]";

/** 상태 배지 색 — 확정/성공은 형광 그린, 대기는 앰버, 거부/취소는 레드. */
export function statusStyle(tone: "ok" | "wait" | "bad" | "idle") {
  switch (tone) {
    case "ok":
      return { borderColor: "var(--color-primary)", color: "var(--color-primary)" };
    case "wait":
      return { borderColor: "var(--color-secondary)", color: "var(--color-secondary)" };
    case "bad":
      return { borderColor: "var(--color-danger)", color: "var(--color-danger)" };
    default:
      return { borderColor: "var(--color-neutral-600)", color: "var(--color-muted)" };
  }
}

export const badgeClass =
  "inline-block rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest";

/** ISO 문자열 → `YYYY-MM-DD HH:mm` (로컬). 날짜 라이브러리가 없는 프로젝트라 직접 포맷한다. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** `<input type="datetime-local">` 이 요구하는 `YYYY-MM-DDTHH:mm` 로컬 표기. */
export function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
