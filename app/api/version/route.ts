import packageJson from "../../../package.json";

// 배포 감지 폴링용 버전 API (components/pwa-prompt.tsx 가 소비).
// package.json 의 version 이 빌드타임에 인라인되므로, 배포(=새 빌드)마다 값이 바뀐다.
// 배포 전 버전 범프가 감지 트리거다 — docs/infra.md "배포 전 버전을 올려주세요" 참조.
// 정합성이 목적이라 CDN 캐시 없이 no-store 로 내보낸다 (저트래픽 폴링이라 부하 미미).
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { version: packageJson.version },
    { headers: { "Cache-Control": "no-store" } },
  );
}
