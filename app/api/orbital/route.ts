import { getOrbitalSnapshot } from "@/lib/joops";

// 궤도 스냅샷 API — 클라이언트 폴링용.
// revalidate = 10: 이 GET 응답이 10초간 캐시(고정)되어, serverTime 을 기준으로 한
// "10초마다 새 스냅샷"이 된다. 클라는 응답의 serverTime 부터 같은 lib/orbit 공식으로 보간.
// (docs/architecture/adr/0005-ssr-orbital-api.md)
export const revalidate = 10;

export async function GET() {
  const snapshot = await getOrbitalSnapshot();
  return Response.json(snapshot);
}
