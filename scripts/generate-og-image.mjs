// scripts/generate-og-image.mjs
// 소스 커버 이미지 → OG/Twitter 공유 이미지 파생 (public/og/opengraph-image.jpg)
//
// 실행: node scripts/generate-og-image.mjs
// 의존: sharp (devDependency).
//
// 소스: public/design-src/og/joops-cover-source.jpg (배경이 균일한 밝은 회색이라
//   가로 패딩으로 1200x630 비율에 맞춰도 이음매가 보이지 않는다).
//
// ⚠️ app/[lang]/opengraph-image.jpg 같은 **파일 기반 컨벤션**으로 두지 않는다.
//   generateStaticParams(en/ko)가 있는 동적 [lang] 세그먼트 안에 정적 이미지 파일을
//   두면 Vercel 빌드에서 "failed to find source route ... for prerender ..." invariant가
//   난다(로컬 next build/start에서는 안 남 — 이 프레임워크 특성상 배포 파이프라인에서만
//   드러나는 케이스). 대신 일반 public/ 자산으로 두고 generateMetadata에서 openGraph/
//   twitter의 images 필드로 명시 참조한다(app/[lang]/layout.tsx).
//
// 산출물:
//   public/og/opengraph-image.jpg  1200x630  (og:image·twitter:image 공용)

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "public/design-src/og/joops-cover-source.jpg");

const WIDTH = 1200;
const HEIGHT = 630;
// 소스 배경색(연회색) — 캔버스를 넓힐 때 이음매 없이 채우기 위한 값.
const BG = { r: 0xcf, g: 0xcf, b: 0xcd };

const targets = [{ out: "public/og/opengraph-image.jpg", label: "opengraph-image" }];

async function run() {
  // 높이를 630에 맞춰 축소한 뒤, 부족한 가로폭을 배경색으로 좌우 패딩해 1200x630을 만든다
  // (크롭 대신 패딩 — 로봇 일러스트 전체가 잘리지 않고 보이도록).
  // ⚠️ sharp 파이프라인에 resize()를 두 번 체이닝하면 뒤의 호출이 앞의 것을 덮어써
  //    extend()가 엉뚱한 크기 위에 적용된다 — 반드시 toBuffer()로 각 단계를 실체화한다.
  const resizedBuf = await sharp(SRC).resize({ height: HEIGHT, fit: "inside" }).toBuffer();
  const { width: scaledWidth = WIDTH } = await sharp(resizedBuf).metadata();
  const padLeft = Math.floor((WIDTH - scaledWidth) / 2);
  const padRight = WIDTH - scaledWidth - padLeft;

  const canvas = await sharp(resizedBuf)
    .extend({ left: padLeft, right: padRight, top: 0, bottom: 0, background: BG })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  for (const t of targets) {
    const outPath = join(root, t.out);
    await sharp(canvas).toFile(outPath);
    console.log(`  ✓ ${t.label.padEnd(20)} → ${t.out} (${WIDTH}x${HEIGHT})`);
  }

  console.log("done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
