// 스플래시 마크 — 디자이너 원본(public/design-src/brand/splash-template.svg)을 인라인 SVG로 포팅.
// 좌표를 마스터에서 그대로 가져오므로 iOS 네이티브 스플래시 PNG(public/brand/splash-*.png)와
// 배치·색이 동일하다. 색도 원본 팔레트를 쓴다(#05080a/#39ff14/#ffb000) — 앱 토큰(민트 그린)과
// 다르지만, 설치형에서 네이티브 스플래시 → 인앱 스플래시 전환이 이어지도록 맞춘 것.
//
// 애니메이션은 app/globals.css 의 .splash-orbit-* / .splash-seg 가 담당하며
// prefers-reduced-motion 에서는 전부 정지 → 정지 상태가 곧 원본 디자인이다.

/** 별 24개 [cx, cy, r, opacity] — 마스터 좌표 그대로(1179×2556 기준). */
const STARS: readonly [number, number, number, number][] = [
  [94, 153, 2.5, 0.5],
  [365, 281, 1.8, 0.35],
  [849, 128, 2.2, 0.45],
  [1061, 332, 1.6, 0.3],
  [177, 511, 1.6, 0.3],
  [648, 409, 2.8, 0.5],
  [979, 613, 1.8, 0.35],
  [59, 843, 2, 0.4],
  [1108, 920, 2.4, 0.45],
  [259, 1329, 1.6, 0.3],
  [920, 1406, 1.8, 0.35],
  [106, 1585, 2.2, 0.4],
  [1073, 1738, 1.6, 0.3],
  [354, 1840, 2, 0.35],
  [802, 1943, 1.6, 0.3],
  [141, 2096, 2.6, 0.45],
  [1002, 2173, 2, 0.4],
  [531, 2249, 1.6, 0.3],
  [295, 2403, 1.8, 0.35],
  [766, 2428, 2.2, 0.4],
  [590, 102, 1.6, 0.3],
  [472, 767, 1.5, 0.25],
  [707, 1150, 1.5, 0.25],
  [212, 1074, 1.7, 0.3],
];

/** 7-세그먼트 글리프(a~g) — 마스터 defs 의 wa~wg. 한 글자 20×36, 글자 간격 28. */
const SEG = {
  a: "M3 2 5 0 15 0 17 2 15 4 5 4Z",
  b: "M18 3 20 5 20 15 18 17 16 15 16 5Z",
  c: "M18 19 20 21 20 31 18 33 16 31 16 21Z",
  d: "M3 34 5 32 15 32 17 34 15 36 5 36Z",
  e: "M2 19 4 21 4 31 2 33 0 31 0 21Z",
  f: "M2 3 4 5 4 15 2 17 0 15 0 5Z",
  g: "M3 18 5 16 15 16 17 18 15 20 5 20Z",
} as const;

type SegKey = keyof typeof SEG;
const SEG_ALL = Object.keys(SEG) as SegKey[];

/** "JOOPS" — 글자별 점등 세그먼트. 꺼진 세그먼트도 opacity 0.1 로 남겨 디지털 시계 느낌을 낸다. */
const LETTERS: readonly SegKey[][] = [
  ["b", "c", "d", "e"], // J
  ["a", "b", "c", "d", "e", "f"], // O
  ["a", "b", "c", "d", "e", "f"], // O
  ["a", "b", "e", "f", "g"], // P
  ["a", "c", "d", "f", "g"], // S
];

export function SplashMark() {
  return (
    <svg
      className="splash-mark"
      viewBox="0 0 1179 2556"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id="splash-dot-glow">
          <stop offset="0%" stopColor="#39ff14" stopOpacity="0.55" />
          <stop offset="40%" stopColor="#39ff14" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#39ff14" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1179" height="2556" fill="#05080a" />

      <g fill="#d8e6d4">
        {STARS.map(([cx, cy, r, o]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} opacity={o} />
        ))}
      </g>

      {/* 엠블럼 — 1024 그리드를 화면 폭 72% / 세로 42% 지점에 배치(마스터 공식) */}
      <g transform="translate(589.5 1073.52) scale(1.3893) translate(-512 -512)">
        <circle cx="512" cy="512" r="190" fill="#071a0d" stroke="#39ff14" strokeWidth="20" />
        <g fill="none" stroke="#39ff14">
          <ellipse cx="512" cy="512" rx="78" ry="190" strokeWidth="9" strokeOpacity="0.55" />
          <path d="M322 512h380" strokeWidth="9" strokeOpacity="0.55" />
          <path d="M343.6 424h336.8M343.6 600h336.8" strokeWidth="8" strokeOpacity="0.35" />
        </g>

        {/* 궤도 링 + 발광 점.
            마스터는 링에 rotate(-24) 를 걸었지만, 여기서는 그 기울기를 부모 그룹으로 올려
            점이 도는 궤도를 "축정렬 타원"으로 만든다 → 스쿼시/카운터 변환만으로 타원 운동이 된다. */}
        <g transform="rotate(-24 512 512)">
          <ellipse
            cx="512"
            cy="512"
            rx="330"
            ry="120"
            fill="none"
            stroke="#ffb000"
            strokeWidth="15"
            strokeOpacity="0.95"
          />
          {/* squash(ry/rx) → spin(t) → 점에서 counter-rotate(-t)·counter-scale 로 원형 복원.
              결과: 점이 (512+330cos t, 512+120sin t) 를 따라 도는 정확한 타원 궤도. */}
          <g className="splash-orbit-squash">
            <g className="splash-orbit-spin">
              <g className="splash-orbit-dot">
                <circle
                  className="splash-orbit-glow"
                  cx="842"
                  cy="512"
                  r="85"
                  fill="url(#splash-dot-glow)"
                />
                <circle cx="842" cy="512" r="26" fill="#39ff14" />
                <circle cx="842" cy="512" r="10" fill="#d6ffcc" />
              </g>
            </g>
          </g>
        </g>
      </g>

      {/* 7-세그먼트 워드마크 "JOOPS" — path 로고타입이라 로케일과 무관하게 고정
          (네이티브 스플래시 PNG 와 동일). 로케일 앱명은 컨테이너의 aria-label 로 전달된다. */}
      <g transform="translate(294.8 1500.5) scale(4.2107)">
        <g transform="translate(4 2) skewX(-6)">
          <g fill="#39ff14" opacity="0.1">
            {LETTERS.map((_, i) => (
              <g key={i} transform={`translate(${i * 28} 0)`}>
                {SEG_ALL.map((s) => (
                  <path key={s} d={SEG[s]} />
                ))}
              </g>
            ))}
          </g>
          <g fill="#39ff14">
            {LETTERS.map((segs, i) => (
              <g
                key={i}
                className="splash-seg"
                style={{ "--i": i } as React.CSSProperties}
                transform={`translate(${i * 28} 0)`}
              >
                {segs.map((s) => (
                  <path key={s} d={SEG[s]} />
                ))}
              </g>
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
}
