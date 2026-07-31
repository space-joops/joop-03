import * as React from "react";

export function ChangeIndicator({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="text-[var(--color-muted)]">–</span>;
  }
  const up = delta > 0;
  return (
    <span style={{ color: up ? "var(--color-success)" : "var(--color-danger)" }}>
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}
