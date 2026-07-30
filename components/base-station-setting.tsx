"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { cities } from "@/lib/cities";
import {
  baseStationFrom,
  readBaseStationSnapshot,
  setBaseStation,
  subscribeBaseStationStore,
} from "@/lib/base-station-prefs";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// 기지국(세계 주요 도시) 검색·선택 설정. 음영 지역 계산과의 실제 연동은 차후 작업 —
// 지금은 선택값을 localStorage 에 저장만 한다(안내 문구로 명시).
export function BaseStationSetting({ dict }: { dict: Dictionary }) {
  const t = dict.settings.baseStation;
  const raw = useSyncExternalStore(subscribeBaseStationStore, readBaseStationSnapshot, () => "");
  const selected = baseStationFrom(raw);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return cities
      .filter((c) => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
      .slice(0, 20);
  }, [query]);

  return (
    <section
      className="crt-brackets px-3 py-2"
      style={{ "--bracket-color": "var(--color-neutral-600)" } as React.CSSProperties}
    >
      <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--color-secondary)]">
        {t.title}
      </h2>

      <p className="mt-2 font-mono text-xs text-[var(--color-muted)]">
        {t.current}: {selected ? `${selected.name}, ${selected.country}` : t.none}
      </p>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.searchPlaceholder}
        className="mt-2 w-full rounded-md border px-2 py-1.5 font-mono text-sm outline-none"
        style={{
          borderColor: "var(--color-neutral-600)",
          background: "var(--color-surface)",
          color: "var(--color-fg)",
        }}
      />

      {query.trim() && (
        <div
          className="mt-2 max-h-48 overflow-y-auto rounded-md border"
          style={{ borderColor: "var(--color-neutral-700)" }}
        >
          {results.length === 0 ? (
            <p className="px-2 py-2 font-mono text-xs text-[var(--color-muted)]">{t.noResults}</p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setBaseStation(c);
                  setQuery("");
                }}
                className="block w-full px-2 py-1.5 text-left font-mono text-xs"
                style={{ color: selected?.id === c.id ? "var(--color-primary)" : "var(--color-fg)" }}
              >
                {c.name}, {c.country}
              </button>
            ))
          )}
        </div>
      )}

      <p className="mt-2 font-mono text-[10px] leading-relaxed text-[var(--color-muted)]">{t.note}</p>
    </section>
  );
}
