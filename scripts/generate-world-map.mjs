// 첫 화면 궤도 추적 뷰의 배경 세계지도(육지 비트 그리드) 생성기.
//
//   node scripts/generate-world-map.mjs   →  lib/world-map-grid.ts 를 덮어쓴다
//
// world-atlas(Natural Earth 110m)의 land TopoJSON을 equirectangular 셀 그리드로
// 래스터화한다. 결과는 144×72 비트맵(셀당 2.5°)을 행마다 hex 문자열로 압축한 것 —
// 전체 ~2.7KB라 클라이언트 번들에 그대로 실어도 부담이 없다.
// 픽셀 블록 미감은 카세트퓨처리즘 컨셉과도 맞는다(디자인 브리프 참고).
//
// 정밀도를 바꾸려면 GRID_W/GRID_H 를 조정하고 다시 실행한다.

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as topojson from "topojson-client";

const require = createRequire(import.meta.url);
const world = require("world-atlas/land-110m.json");

const GRID_W = 144; // 경도 −180~180 → 2.5°/셀
const GRID_H = 72; //  위도  +90~−90 → 2.5°/셀

const land = topojson.feature(world, world.objects.land);

// point-in-polygon (ray casting). GeoJSON 링은 [lon, lat].
function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function inPolygon(lon, lat, polygon) {
  // polygon = [outer, hole, hole...]
  if (!inRing(lon, lat, polygon[0])) return false;
  for (let h = 1; h < polygon.length; h++) {
    if (inRing(lon, lat, polygon[h])) return false;
  }
  return true;
}

function isLand(lon, lat) {
  for (const feature of land.features) {
    const g = feature.geometry;
    if (g.type === "Polygon") {
      if (inPolygon(lon, lat, g.coordinates)) return true;
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) {
        if (inPolygon(lon, lat, poly)) return true;
      }
    }
  }
  return false;
}

const rows = [];
for (let gy = 0; gy < GRID_H; gy++) {
  const lat = 90 - ((gy + 0.5) / GRID_H) * 180;
  let bits = "";
  for (let gx = 0; gx < GRID_W; gx++) {
    const lon = -180 + ((gx + 0.5) / GRID_W) * 360;
    bits += isLand(lon, lat) ? "1" : "0";
  }
  // 4비트씩 hex 로 압축
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  rows.push(hex);
}

const out = `// 자동 생성 파일 — 직접 수정하지 마세요. 재생성: node scripts/generate-world-map.mjs
// Natural Earth 110m land → ${GRID_W}×${GRID_H} equirectangular 비트 그리드(행별 hex).
// 셀 (gx,gy) 중심: lon = -180 + (gx+0.5)/${GRID_W}*360, lat = 90 - (gy+0.5)/${GRID_H}*180.

export const WORLD_GRID_W = ${GRID_W};
export const WORLD_GRID_H = ${GRID_H};

const ROWS: readonly string[] = [
${rows.map((r) => `  "${r}",`).join("\n")}
];

/** (gx, gy) 셀이 육지인지. 범위 밖은 false. */
export function isLandCell(gx: number, gy: number): boolean {
  if (gx < 0 || gx >= WORLD_GRID_W || gy < 0 || gy >= WORLD_GRID_H) return false;
  const nibble = parseInt(ROWS[gy][gx >> 2], 16);
  return (nibble & (0b1000 >> (gx & 3))) !== 0;
}
`;

writeFileSync(new URL("../lib/world-map-grid.ts", import.meta.url), out);
const landCells = rows.join("").split("").reduce((n, c) => n + parseInt(c, 16).toString(2).split("1").length - 1, 0);
console.log(`lib/world-map-grid.ts 생성 완료 — ${GRID_W}×${GRID_H}, 육지 셀 ${landCells}개`);
