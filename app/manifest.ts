import type { MetadataRoute } from "next";

// PWA 매니페스트 — 세로 고정 설치형 (docs/architecture/adr/0002-pwa-portrait.md).
// 아이콘: scripts/generate-icons.mjs 로 마스터 SVG 에서 파생 → docs/design/asset-inventory.md
// 색상: app/globals.css 의 --color-bg 와 일치(#05080a, 토큰 v1.0).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JOOPS — 함께 우주를 청소합니다",
    short_name: "JOOPS",
    description: "지구 궤도의 우주 쓰레기를 청소하는 반려형 우주 로봇 게임",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05080a",
    theme_color: "#05080a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
