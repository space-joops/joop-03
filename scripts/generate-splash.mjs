// scripts/generate-splash.mjs
// iOS 스타트업 이미지(스플래시) PNG 5종 생성 — docs/design/handoff-m1.md §3-2, 부록 A
//
// 실행: npm run gen:splash
// 의존: sharp (devDependency)
//
// ── 왜 "리사이즈"가 아니라 "사이즈별 재렌더"인가 ────────────────────────────
// iOS 는 apple-touch-startup-image 를 기기 해상도와 **정확히 일치할 때만** 적용한다.
// 한 장을 만들어 늘리면 업스케일 아티팩트가 생기므로, 사이즈마다 SVG 를 새로 조립해
// 벡터 상태로 렌더한다. 배치는 화면 비율 기준(아래 상수)이라 어떤 해상도에서도 같은 구도가 나온다.
//
// ── 기하의 출처 ──────────────────────────────────────────────────────────
// 디자이너 마스터: public/design-src/brand/splash-template.svg (1179×2556)
// 이 스크립트의 상수/마크업은 그 마스터에서 뽑아온 것이고, 인앱 스플래시
// components/splash-mark.tsx 도 같은 기하를 쓴다. **셋 중 하나를 고치면 나머지도 함께 고칠 것.**
// (마스터에서 splashSvg(1179, 2556) 을 돌리면 마스터와 같은 그림이 나온다 — 검증 기준)
//
// ── 래스터 제약(librsvg) ─────────────────────────────────────────────────
// <text> 금지(시스템 폰트 폴백으로 환경마다 달라짐 → 글자는 전부 path),
// filter 금지(글로우는 radialGradient 헤일로로), currentColor 입력 금지.

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 산출물 해상도 — app/[lang]/layout.tsx 의 APPLE_STARTUP_IMAGES media 쿼리와 1:1 */
const SIZES = [
  [1179, 2556], // 393×852 @3x
  [1206, 2622], // 402×874 @3x
  [1290, 2796], // 430×932 @3x
  [1320, 2868], // 440×956 @3x
  [1170, 2532], // 390×844 @3x
];

/** 마스터 기준 프레임 — 별 좌표와 스케일 환산의 분모 */
const BASE_W = 1179;
const BASE_H = 2556;

/** 배치 비율(마스터에 하드코딩된 값의 출처) */
const EMBLEM_WIDTH_RATIO = 0.72; // 궤도 가로폭이 화면 폭의 72%
const EMBLEM_ORBIT_WIDTH = 611; // 1024 그리드에서 기울어진 궤도 타원의 가로 실폭
const EMBLEM_CENTER_Y = 0.42; // 화면 높이의 42% 지점
const WORDMARK_WIDTH_RATIO = 0.5; // 워드마크 폭이 화면 폭의 50%
const WORDMARK_WIDTH = 140; // 글자 5개 × 28
const WORDMARK_CENTER_Y = 0.62; // 화면 높이의 62% 지점

const C = {
  bg: "#05080a",
  green: "#39ff14",
  amber: "#ffb000",
  star: "#d8e6d4",
  globe: "#071a0d",
  dotCore: "#d6ffcc",
};

/** 별 24개 [cx, cy, r, opacity] — 마스터 좌표(1179×2556). 해상도에 맞춰 비례 배치한다. */
const STARS = [
  [94, 153, 2.5, 0.5], [365, 281, 1.8, 0.35], [849, 128, 2.2, 0.45], [1061, 332, 1.6, 0.3],
  [177, 511, 1.6, 0.3], [648, 409, 2.8, 0.5], [979, 613, 1.8, 0.35], [59, 843, 2, 0.4],
  [1108, 920, 2.4, 0.45], [259, 1329, 1.6, 0.3], [920, 1406, 1.8, 0.35], [106, 1585, 2.2, 0.4],
  [1073, 1738, 1.6, 0.3], [354, 1840, 2, 0.35], [802, 1943, 1.6, 0.3], [141, 2096, 2.6, 0.45],
  [1002, 2173, 2, 0.4], [531, 2249, 1.6, 0.3], [295, 2403, 1.8, 0.35], [766, 2428, 2.2, 0.4],
  [590, 102, 1.6, 0.3], [472, 767, 1.5, 0.25], [707, 1150, 1.5, 0.25], [212, 1074, 1.7, 0.3],
];

/** 7-세그먼트 글리프(a~g) — 한 글자 20×36, 글자 간격 28 */
const SEG = {
  a: "M3 2 5 0 15 0 17 2 15 4 5 4Z",
  b: "M18 3 20 5 20 15 18 17 16 15 16 5Z",
  c: "M18 19 20 21 20 31 18 33 16 31 16 21Z",
  d: "M3 34 5 32 15 32 17 34 15 36 5 36Z",
  e: "M2 19 4 21 4 31 2 33 0 31 0 21Z",
  f: "M2 3 4 5 4 15 2 17 0 15 0 5Z",
  g: "M3 18 5 16 15 16 17 18 15 20 5 20Z",
};
const SEG_ALL = Object.keys(SEG);

/** "JOOPS" — 글자별 점등 세그먼트 (꺼진 세그먼트는 opacity 0.1 고스트로 남는다) */
const LETTERS = [
  ["b", "c", "d", "e"], // J
  ["a", "b", "c", "d", "e", "f"], // O
  ["a", "b", "c", "d", "e", "f"], // O
  ["a", "b", "e", "f", "g"], // P
  ["a", "c", "d", "f", "g"], // S
];

/** 엠블럼 — 1024 그리드(중심 512,512). 와이어프레임 지구 + 앰버 궤도 링 + 발광 점. */
const EMBLEM = `
  <circle cx="512" cy="512" r="190" fill="${C.globe}" stroke="${C.green}" stroke-width="20"/>
  <g fill="none" stroke="${C.green}">
    <ellipse cx="512" cy="512" rx="78" ry="190" stroke-width="9" stroke-opacity="0.55"/>
    <path d="M322 512h380" stroke-width="9" stroke-opacity="0.55"/>
    <path d="M343.6 424h336.8M343.6 600h336.8" stroke-width="8" stroke-opacity="0.35"/>
  </g>
  <ellipse cx="512" cy="512" rx="330" ry="120" fill="none" stroke="${C.amber}" stroke-width="15" stroke-opacity="0.95" transform="rotate(-24 512 512)"/>
  <circle cx="731" cy="339" r="85" fill="url(#sdg)"/>
  <circle cx="731" cy="339" r="26" fill="${C.green}"/>
  <circle cx="731" cy="339" r="10" fill="${C.dotCore}"/>`;

/** 워드마크 — <use> 대신 path 를 직접 펼친다(librsvg 의 href 지원 편차를 피한다). */
function wordmark() {
  const glyph = (segs, i) =>
    `<g transform="translate(${i * 28} 0)">${segs.map((s) => `<path d="${SEG[s]}"/>`).join("")}</g>`;
  const ghost = LETTERS.map((_, i) => glyph(SEG_ALL, i)).join("");
  const lit = LETTERS.map((segs, i) => glyph(segs, i)).join("");
  return `
    <g transform="translate(4 2) skewX(-6)">
      <g fill="${C.green}" opacity="0.1">${ghost}</g>
      <g fill="${C.green}">${lit}</g>
    </g>`;
}

/** 목표 해상도에 맞춰 스플래시 SVG 를 조립한다(리사이즈가 아니라 재조립). */
function splashSvg(w, h) {
  const sx = w / BASE_W;
  const sy = h / BASE_H;
  const stars = STARS.map(
    ([x, y, r, o]) =>
      `<circle cx="${(x * sx).toFixed(1)}" cy="${(y * sy).toFixed(1)}" r="${(r * sx).toFixed(2)}" opacity="${o}" fill="${C.star}"/>`,
  ).join("");

  const es = (EMBLEM_WIDTH_RATIO * w) / EMBLEM_ORBIT_WIDTH;
  const ws = (WORDMARK_WIDTH_RATIO * w) / WORDMARK_WIDTH;
  const wordX = w / 2 - (WORDMARK_WIDTH / 2) * ws;
  const wordY = h * WORDMARK_CENTER_Y - 20 * ws; // 20 = 글리프 높이 40의 절반

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="sdg">
      <stop offset="0%" stop-color="${C.green}" stop-opacity="0.55"/>
      <stop offset="40%" stop-color="${C.green}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${C.green}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="${C.bg}"/>
  <g>${stars}</g>
  <g transform="translate(${w / 2} ${(h * EMBLEM_CENTER_Y).toFixed(2)}) scale(${es.toFixed(4)}) translate(-512 -512)">${EMBLEM}
  </g>
  <g transform="translate(${wordX.toFixed(1)} ${wordY.toFixed(1)}) scale(${ws.toFixed(4)})">${wordmark()}
  </g>
</svg>`;
}

async function run() {
  for (const [w, h] of SIZES) {
    const out = `public/brand/splash-${w}x${h}.png`;
    const info = await sharp(Buffer.from(splashSvg(w, h)))
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(join(root, out));
    const kb = (info.size / 1024).toFixed(0);
    console.log(`  ✓ ${`splash ${w}×${h}`.padEnd(22)} → ${out} (${info.width}x${info.height}, ${kb}KB)`);
  }
  console.log("done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
