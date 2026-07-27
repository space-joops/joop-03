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
//   app/favicon.ico                16+32    (PNG-in-ICO — 모던 브라우저 대상)

import sharp from "sharp";
import { writeFile } from "node:fs/promises";
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

// PNG 여러 장을 ICO 컨테이너로 패킹 (ICONDIR 6B + ICONDIRENTRY 16B×n + PNG 블롭).
// ICO 는 PNG 임베드를 허용하며 모던 브라우저는 모두 지원한다.
function packIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += buf.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]);
}

async function run() {
  for (const t of targets) {
    const outPath = join(root, t.out);
    const info = await sharp(join(SRC, t.src), { density: DENSITY })
      .resize(t.size, t.size, { fit: "cover" })
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(outPath);
    console.log(`  ✓ ${t.label.padEnd(20)} → ${t.out} (${info.width}x${info.height})`);
  }

  // favicon: icon-master 를 16/32 로 래스터해 ICO 로 패킹
  const faviconSizes = [16, 32];
  const pngs = [];
  for (const size of faviconSizes) {
    const buf = await sharp(join(SRC, "icon-master.svg"), { density: DENSITY })
      .resize(size, size, { fit: "cover" })
      .png({ compressionLevel: 9, effort: 10 })
      .toBuffer();
    pngs.push({ size, buf });
  }
  const icoPath = join(root, "app/favicon.ico");
  await writeFile(icoPath, packIco(pngs));
  console.log(`  ✓ ${"favicon 16+32".padEnd(20)} → app/favicon.ico`);

  console.log("done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
