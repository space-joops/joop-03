import type { MetadataRoute } from "next";

// PWA 매니페스트 — 세로 고정 설치형 (docs/architecture/adr/0002-pwa-portrait.md).
// 아이콘은 임시(icon.svg). 디자이너 에셋(192/512/maskable) 오면 교체 → docs/design/asset-inventory.md
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JOOPS — 함께 우주를 청소합니다",
    short_name: "JOOPS",
    description: "지구 궤도의 우주 쓰레기를 청소하는 반려형 우주 로봇 게임",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050810",
    theme_color: "#050810",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
