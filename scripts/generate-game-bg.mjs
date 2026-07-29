// scripts/generate-game-bg.mjs
// 아케이드 배경 천체 마스터 → WebP 파생 (docs/design/asset-inventory.md §C)
//
// 실행: npm run gen:game   (= node scripts/generate-game-bg.mjs)
// 의존: playwright(Chromium) + sharp (devDependencies)
//
// 왜 sharp(librsvg)가 아니라 Chromium 렌더인가:
//   마스터의 핵심(구름·레골리스·은하 밴드)이 feTurbulence/feDisplacementMap 필터인데
//   librsvg 는 이 필터들의 구현이 불완전해 결과가 다르게 나온다. Chromium 은 SVG Filter
//   Effects 를 스펙대로 구현하므로, 브라우저로 마스터를 열어 본 것과 산출물이 일치한다.
//   Chromium 경로를 지정하려면: GAME_BG_CHROMIUM=/path/to/chromium npm run gen:game
//
// 파이프라인:
//   1. bg-earth-land.png  — world-atlas land-50m → 등장방형 마스크 → 역직교투영 per-pixel
//                           대륙층(2048² 마스터가 <image> 로 참조). 결정적이라 재실행 멱등.
//   2. bg-galaxy-master.svg 의 @stars 마커 구간에 시드 PRNG 별밭 주입(멱등).
//   3. 마스터 4종을 Chromium 으로 렌더 → sharp 로 WebP 인코드.
//   4. 크기 게이트 — 목표 초과 시 품질을 낮춰 1회 재시도, 그래도 크면 경고.

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import * as topojson from "topojson-client";
import sharp from "sharp";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "public/design-src/game");
const OUT = join(root, "public/game");

// ── 산출 목록: 해상도는 DPR3 실기기에서 그려지는 최대 크기(지구 ≈ 2900 버퍼px) 기준.
//    소프트 콘텐츠(구름·글로우)라 1.4× 업스케일은 무해 — 문제였던 것은 1024 소스의
//    하드 엣지 2.8× 확대다. quality 는 크기 게이트(maxKB) 초과 시 -8 재시도.
// srcW/srcH = 마스터 SVG 고유 크기. ⚠️ 뷰포트는 반드시 고유 크기로 잡는다 —
// 최상위 SVG 문서는 뷰포트에 맞춰 스케일되지 않으므로, 뷰포트가 작으면 크롭된다
// (태양 글로우 가장자리가 수직선으로 잘리는 사고의 원인). 목표 크기(w/h)로는
// sharp 리사이즈로 내린다.
const TARGETS = [
  { master: "bg-earth-master.svg", out: "bg-earth.webp", srcW: 2048, srcH: 2048, w: 2048, h: 2048, quality: 80, maxKB: 350, alpha: true },
  { master: "bg-moon-master.svg", out: "bg-moon.webp", srcW: 1536, srcH: 1536, w: 1536, h: 1536, quality: 78, maxKB: 250, alpha: true },
  // 태양은 전면 알파 글로우라 webp 압축이 나쁘다 — 소프트 콘텐츠이므로 1792 로 낮춰 상쇄
  { master: "bg-sun-master.svg", out: "bg-sun.webp", srcW: 2048, srcH: 2048, w: 1792, h: 1792, quality: 78, maxKB: 280, alpha: true },
  { master: "bg-galaxy-master.svg", out: "bg-galaxy.webp", srcW: 3072, srcH: 1536, w: 3072, h: 1536, quality: 72, maxKB: 400, alpha: false },
  // 유명 은하 5종(장식 오브젝트, 알파) — 새 은하 추가는 마스터 1개 + 이 표 1행 + lib/arcade.ts CELESTIALS 1행
  { master: "bg-galaxy-andromeda-master.svg", out: "bg-galaxy-andromeda.webp", srcW: 1024, srcH: 768, w: 1024, h: 768, quality: 75, maxKB: 120, alpha: true },
  { master: "bg-galaxy-sombrero-master.svg", out: "bg-galaxy-sombrero.webp", srcW: 1024, srcH: 512, w: 1024, h: 512, quality: 75, maxKB: 100, alpha: true },
  { master: "bg-galaxy-whirlpool-master.svg", out: "bg-galaxy-whirlpool.webp", srcW: 1024, srcH: 1024, w: 1024, h: 1024, quality: 75, maxKB: 120, alpha: true },
  { master: "bg-galaxy-pinwheel-master.svg", out: "bg-galaxy-pinwheel.webp", srcW: 1024, srcH: 1024, w: 1024, h: 1024, quality: 75, maxKB: 120, alpha: true },
  { master: "bg-galaxy-lmc-master.svg", out: "bg-galaxy-lmc.webp", srcW: 1024, srcH: 768, w: 1024, h: 768, quality: 75, maxKB: 120, alpha: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// 1) 지구 대륙층 — SVG 필터로는 구면 투영이 불가능하므로 스크립트가 만든다.
//    world-atlas(Natural Earth 50m) → 등장방형 마스크 캔버스 → 역직교투영으로
//    픽셀→(lon,lat)→육지 판정. 역투영 방식이라 지평선 폴리곤 클리핑이 필요 없다.
//    (generate-world-map.mjs 와 같은 데이터 소스, 다른 해상도·투영)

const LAND_SIZE = 1660; // 마스터의 지구 디스크 지름(px) — bg-earth-master.svg 와 맞물림
const VIEW_LON = 15; // 뷰 중심: 아프리카·유럽·대서양 (ISS 사진에서 흔한 인지 가능 구도)
const VIEW_LAT = 20;

async function renderLandLayer(browser) {
  const require = createRequire(import.meta.url);
  const world = require("world-atlas/land-50m.json");
  const land = topojson.feature(world, world.objects.land);
  // MultiPolygon/Polygon → [ [outer, hole...], ... ] 로 평탄화해 페이지에 전달
  const polys = [];
  for (const f of land.features) {
    const g = f.geometry;
    if (g.type === "Polygon") polys.push(g.coordinates);
    else for (const p of g.coordinates) polys.push(p);
  }

  const page = await browser.newPage({ viewport: { width: 100, height: 100 } });
  const dataUrl = await page.evaluate(
    ({ polys, size, lon0deg, lat0deg }) => {
      // (a) 등장방형 육지 마스크 — Path2D 채우기(evenodd 로 구멍 처리)
      const MW = 2880, MH = 1440;
      const mask = document.createElement("canvas");
      mask.width = MW;
      mask.height = MH;
      const mctx = mask.getContext("2d", { willReadFrequently: true });
      mctx.fillStyle = "#fff";
      for (const poly of polys) {
        const path = new Path2D();
        for (const ring of poly) {
          ring.forEach(([lon, lat], i) => {
            const x = ((lon + 180) / 360) * MW;
            const y = ((90 - lat) / 180) * MH;
            if (i === 0) path.moveTo(x, y);
            else path.lineTo(x, y);
          });
          path.closePath();
        }
        mctx.fill(path, "evenodd");
      }
      const maskData = mctx.getImageData(0, 0, MW, MH).data;
      const isLand = (lon, lat) => {
        const mx = Math.min(MW - 1, Math.max(0, Math.round(((lon + 180) / 360) * MW)));
        const my = Math.min(MH - 1, Math.max(0, Math.round(((90 - lat) / 180) * MH)));
        return maskData[(my * MW + mx) * 4 + 3] > 127;
      };

      // (b) 결정적 value noise (시드 해시 + smoothstep 보간, 2옥타브)
      const hash = (ix, iy, s) => {
        let h = (ix * 374761393 + iy * 668265263 + s * 1442695041) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
      };
      const noise = (x, y, cell, seed) => {
        const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
        const fx = x / cell - gx, fy = y / cell - gy;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const a = hash(gx, gy, seed), b = hash(gx + 1, gy, seed);
        const c = hash(gx, gy + 1, seed), d = hash(gx + 1, gy + 1, seed);
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
      };

      // (c) 역직교투영 렌더 — 픽셀 → 단위구 (nx,ny,z) → 회전 → (lon,lat)
      const R = size / 2;
      const lon0 = (lon0deg * Math.PI) / 180;
      const lat0 = (lat0deg * Math.PI) / 180;
      const sinLat0 = Math.sin(lat0), cosLat0 = Math.cos(lat0);
      const cv = document.createElement("canvas");
      cv.width = size;
      cv.height = size;
      const ctx = cv.getContext("2d");
      const img = ctx.createImageData(size, size);
      const px = img.data;
      // 팔레트: 밝은 행성 톤(레퍼런스 2026-07-28)에 맞춘 파스텔 초록 2 + 사막 (네온 금지)
      const GREEN_A = [92, 130, 105], GREEN_B = [122, 138, 96], DESERT = [172, 155, 116];
      const OCEAN = [58, 135, 190]; // 대기 산란 톤다운용 — 마스터 ocean 그라데이션 중간톤
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const nx = (x - R) / R;
          const ny = (R - y) / R;
          const rho2 = nx * nx + ny * ny;
          if (rho2 > 1) continue; // 디스크 밖 = 투명
          const z = Math.sqrt(1 - rho2);
          const lat = Math.asin(ny * cosLat0 + z * sinLat0);
          const lon = lon0 + Math.atan2(nx, z * cosLat0 - ny * sinLat0);
          const lonDeg = ((lon * 180) / Math.PI + 540) % 360 - 180;
          const latDeg = (lat * 180) / Math.PI;
          if (!isLand(lonDeg, latDeg)) continue; // 바다 = 투명(마스터 그라데이션이 비침)
          // 식생/사막 혼합 — 저주파 노이즈 2옥타브
          const n = noise(x, y, 190, 7) * 0.65 + noise(x, y, 55, 13) * 0.35;
          let c;
          if (n < 0.42) c = GREEN_A;
          else if (n < 0.62) c = GREEN_B;
          else c = DESERT;
          // 전면 22% + 림 근처 추가 산란 — 대륙이 배경 블루에 스며들어 밝은 행성 톤 유지
          const rho = Math.sqrt(rho2);
          const mix = 0.22 + (rho > 0.82 ? ((rho - 0.82) / 0.18) * 0.15 : 0);
          const i = (y * size + x) * 4;
          px[i] = c[0] + (OCEAN[0] - c[0]) * mix;
          px[i + 1] = c[1] + (OCEAN[1] - c[1]) * mix;
          px[i + 2] = c[2] + (OCEAN[2] - c[2]) * mix;
          px[i + 3] = 210; // 살짝 투명 — 해양 그라데이션과 어우러지게
        }
      }
      ctx.putImageData(img, 0, 0);
      return cv.toDataURL("image/png");
    },
    { polys, size: LAND_SIZE, lon0deg: VIEW_LON, lat0deg: VIEW_LAT },
  );
  await page.close();

  const buf = Buffer.from(dataUrl.split(",")[1], "base64");
  const outPath = join(SRC, "bg-earth-land.png");
  const prev = safeRead(outPath);
  if (!prev || !prev.equals(buf)) writeFileSync(outPath, buf);
  console.log(`  ✓ ${"bg-earth-land.png".padEnd(22)} ${LAND_SIZE}x${LAND_SIZE} (${kb(buf.length)})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) 은하 마스터 별밭 주입 — @stars 마커 사이를 시드 PRNG 로 교체(결정적·멱등).
//    타일 이음새: 양쪽 가장자리 24px 안의 별은 반대편에 복제해 수평 랩을 맞춘다.

const GALAXY_W = 3072;
const GALAXY_H = 1536;
const STAR_COUNT = 1200;
// 색온도 4종(웜화이트/백/청/주황) 가중치 4:3:2:1 — 실제 별 스펙트럼 분포 흉내
const STAR_COLORS = ["#fff3e4", "#fff3e4", "#fff3e4", "#fff3e4", "#f4f7ff", "#f4f7ff", "#f4f7ff", "#cfe0ff", "#cfe0ff", "#ffd9a8"];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function injectStars() {
  const path = join(SRC, "bg-galaxy-master.svg");
  const svg = readFileSync(path, "utf8");
  const rand = mulberry32(20260728);
  const circles = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const x = +(rand() * GALAXY_W).toFixed(1);
    // 은하 밴드(y≈700±260) 쪽 밀도를 높인다 — 두 난수 평균으로 중앙 몰림
    const band = rand() < 0.55;
    const y = band
      ? +(700 + (rand() + rand() - 1) * 260).toFixed(1)
      : +(rand() * GALAXY_H).toFixed(1);
    const r = +(0.5 + rand() * 1.1).toFixed(2);
    const color = STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)];
    const o = +(0.3 + rand() * 0.7).toFixed(2);
    const put = (cx) => circles.push(`<circle cx="${cx}" cy="${y}" r="${r}" fill="${color}" opacity="${o}"/>`);
    put(x);
    if (x < 24) put(+(x + GALAXY_W).toFixed(1)); // 수평 랩 복제
    if (x > GALAXY_W - 24) put(+(x - GALAXY_W).toFixed(1));
  }
  const block = `<!-- @stars:start (자동 생성 — gen:game 이 교체, 직접 수정 금지) -->\n  ${circles.join("\n  ")}\n  <!-- @stars:end -->`;
  const next = svg.replace(/<!-- @stars:start[\s\S]*?@stars:end -->/, block);
  if (next !== svg) writeFileSync(path, next);
  console.log(`  ✓ ${"별밭 주입".padEnd(22)} ${circles.length}개 (시드 고정)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) 마스터 렌더 + 4) WebP 인코드

function safeRead(p) {
  try {
    return readFileSync(p);
  } catch {
    return null;
  }
}
const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

async function renderMasters(browser) {
  for (const t of TARGETS) {
    const page = await browser.newPage({
      viewport: { width: t.srcW, height: t.srcH },
      deviceScaleFactor: 1,
    });
    await page.goto(pathToFileURL(join(SRC, t.master)).href, { waitUntil: "networkidle" });
    // feTurbulence 대형 필터는 첫 페인트가 늦을 수 있다 — 한 프레임 더 대기
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const png = await page.screenshot({ omitBackground: t.alpha, type: "png" });
    await page.close();

    let quality = t.quality;
    let webp = await encode(png, t, quality);
    if (webp.length > t.maxKB * 1024) {
      quality -= 8;
      webp = await encode(png, t, quality);
      if (webp.length > t.maxKB * 1024) {
        console.warn(`  ⚠ ${t.out}: ${kb(webp.length)} > 목표 ${t.maxKB}KB (q${quality}) — 마스터 복잡도 점검 필요`);
      }
    }
    writeFileSync(join(OUT, t.out), webp);
    console.log(`  ✓ ${t.out.padEnd(22)} ${t.w}x${t.h} q${quality} → ${kb(webp.length)}`);
  }
}

const encode = (png, t, quality) =>
  sharp(png)
    .resize(t.w, t.h)
    .webp({ quality, effort: 6, alphaQuality: 90, smartSubsample: true })
    .toBuffer();

// ─────────────────────────────────────────────────────────────────────────────
// 벡터 그대로 쓰는 마스터는 래스터하지 않고 원문을 복사한다(브라우저가 직접 그린다).
// 손으로 복사하던 관행이 언젠가 어긋나므로 파이프라인에 넣어 단일 진실을 보장.

const SVG_COPIES = [
  ["rocket-master.svg", "rocket.svg"],
  ["cubesat-master.svg", "cubesat.svg"],
];

function copySvgMasters() {
  for (const [src, out] of SVG_COPIES) {
    const buf = readFileSync(join(SRC, src));
    const prev = safeRead(join(OUT, out));
    if (!prev || !prev.equals(buf)) writeFileSync(join(OUT, out), buf);
    console.log(`  ✓ ${out.padEnd(22)} (마스터 복사, ${kb(buf.length)})`);
  }
}

async function run() {
  const executablePath = process.env.GAME_BG_CHROMIUM || undefined;
  const browser = await chromium.launch({ executablePath });
  try {
    copySvgMasters();
    injectStars();
    await renderLandLayer(browser);
    await renderMasters(browser);
  } finally {
    await browser.close();
  }
  console.log("done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
