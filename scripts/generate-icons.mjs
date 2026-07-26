// scripts/generate-icons.mjs
// 마스터 SVG → PWA/앱 아이콘 PNG 파생 (docs/design/asset-inventory.md, docs/design/README.md)
//
// 실행: node scripts/generate-icons.mjs
// 의존: sharp (devDependency). 소스 SVG 를 수정한 뒤 다시 실행해 PNG 를 재생성한다.
//
// 산출물:
//   public/icon-192.png            192x192  (manifest, purpose "any")
//   public/icon-512.png            512x512  (manifest, purpose "any")
//   public/icon-maskable-512.png   512x512  (manifest, purpose "maskable" — 안전영역 준수)
//   app/apple-icon.png             180x180  (Next.js 파일기반 apple-touch)

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "public/design-src/icons");

// 고밀도로 래스터한 뒤 목표 크기로 다운스케일 → 형광 엣지가 선명하게.
const DENSITY = 384;

/** @type {{src:string,out:string,size:number,label:string}[]} */
const targets = [
  { src: "icon-master.svg", out: "public/icon-192.png", size: 192, label: "icon 192 (any)" },
  { src: "icon-master.svg", out: "public/icon-512.png", size: 512, label: "icon 512 (any)" },
  {
    src: "icon-maskable-master.svg",
    out: "public/icon-maskable-512.png",
    size: 512,
    label: "icon 512 (maskable)",
  },
  {
    src: "icon-maskable-master.svg",
    out: "app/apple-icon.png",
    size: 180,
    label: "apple-touch 180",
  },
];

async function run() {
  for (const t of targets) {
    const outPath = join(root, t.out);
    const info = await sharp(join(SRC, t.src), { density: DENSITY })
      .resize(t.size, t.size, { fit: "cover" })
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(outPath);
    console.log(`  ✓ ${t.label.padEnd(20)} → ${t.out} (${info.width}x${info.height})`);
  }
  console.log("done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
