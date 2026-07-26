import { getOrbitalSnapshot } from "@/lib/joops";

// 궤도 스냅샷 API — 클라이언트 폴링용.
//
// 이전에는 `export const revalidate = 10` 이었다. 그런데 세그먼트 revalidate 는 정적 분석
// 대상이라 리터럴만 쓸 수 있어서, 관리자가 joop_03_game_config.orbital_tick_seconds 를 바꿔도
// 서버 스냅샷 주기는 10초에 고정돼 있었다(= FR-10.1 "좌표 계산 주기 설정"이 반쪽).
//
// 그래서 라우트를 동적으로 두고 Cache-Control 을 설정값으로 계산해 내보낸다. CDN 이
// s-maxage 동안 같은 응답을 고정하므로 "N초마다 새 스냅샷"이라는 ADR-0005 의 설계 의도는
// 그대로 유지되면서 N 이 관리자 설정을 따른다.
// (docs/architecture/adr/0005-ssr-orbital-api.md)
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getOrbitalSnapshot();
  const ttl = Math.max(1, Math.round(snapshot.tickSeconds));

  return Response.json(snapshot, {
    headers: {
      "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl}`,
    },
  });
}
