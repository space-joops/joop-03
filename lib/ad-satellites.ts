// 광고 위성(FR-7.7 원근 연출 선행 + FR-9.1 초대코드 보상의 진입점) — 순수 모듈.
//
// TODO(광고 관리자): 관리자 기능이 생기면 이 배열을 DB(광고 위성 테이블) 조회로 대체한다.
// 지금은 파일 하드코딩 — 클라이언트 사이드에서 DB 무관하게 등장해야 한다는 요구.
//
// 렌더 규칙: 본체는 SVG 에셋, 브랜드 워드마크는 캔버스 fillText(ui-monospace)가
// label 파라미터 위치에 그린다 — SVG <text> 금지 규약 유지 + 원거리 자동 생략 가능.

export type AdSatellite = {
  id: "vrerv" | "diginori" | "spacex" | "obital-radar" | "uzuro-tech" | "spacemap";
  /** 워드마크 원문(대소문자 유지) */
  brand: string;
  /** 브랜드 색 — 워드마크·도킹 링·토스트 보더 */
  color: string;
  asset: string;
  /** 초대코드 라벨(JOOP-<LABEL>-NN) — /^[A-Z0-9]{2,10}$/ 필수 */
  codeLabel: string;
  /** 워드마크 배치: dy = 본체 폭 대비 세로 오프셋, wFrac = 글자 크기(본체 폭 비율) */
  label: { dy: number; wFrac: number };
};

export const AD_SATELLITES: readonly AdSatellite[] = [
  {
    id: "vrerv",
    brand: "VReRV",
    color: "#c964ff",
    asset: "/game/ad-sat-vrerv.svg",
    codeLabel: "VRERV",
    label: { dy: 0.16, wFrac: 0.062 },
  },
  {
    id: "diginori",
    brand: "digiNORI",
    color: "#b8e04a",
    asset: "/game/ad-sat-diginori.svg",
    codeLabel: "DIGINORI",
    label: { dy: 0.168, wFrac: 0.052 },
  },
  {
    id: "spacex",
    brand: "SpaceX",
    color: "#cfd8dc",
    asset: "/game/ad-sat-spacex.svg",
    codeLabel: "SPACEX",
    label: { dy: 0.153, wFrac: 0.06 },
  },
  {
    id: "obital-radar",
    brand: "OBITAL RADAR",
    color: "#38e0f0",
    asset: "/game/ad-sat-obital-radar.svg",
    codeLabel: "OBRADAR",
    label: { dy: 0.188, wFrac: 0.042 },
  },
  {
    id: "uzuro-tech",
    brand: "UZURO Tech",
    color: "#ffb23e",
    asset: "/game/ad-sat-uzuro-tech.svg",
    codeLabel: "UZURO",
    label: { dy: 0.167, wFrac: 0.048 },
  },
  {
    id: "spacemap",
    brand: "SPACEMAP",
    color: "#37d67a",
    asset: "/game/ad-sat-spacemap.svg",
    codeLabel: "SPACEMAP",
    label: { dy: 0.174, wFrac: 0.05 },
  },
];

export function adSatelliteById(id: string): AdSatellite | null {
  return AD_SATELLITES.find((s) => s.id === id) ?? null;
}

// ── 플라이바이(스타워즈식 원근 통과) ────────────────────────────────────────
//
// 스크린 공간 보간이 아니라 **진짜 1/z 투영**이다: z 가 선형으로 줄면
// scale = BASE/z 는 "느리게 → 급격히" 곡선이 공짜로 나온다(오프닝 우주선 그 곡선).
// 카메라 결합항(camΔ·couple/z) 덕에 줍스가 위성 쪽으로 날면 1/z 배율로
// 접근한다 — 도킹이 "쫓아가는 플레이"가 된다.
// 좌표계: 화면 중심(=줍스) 기준, 단위는 월드 u(= min(W,H)).

export type AdFlyby = {
  satId: AdSatellite["id"];
  /** 게임 elapsed 초 기준 시작 시각 */
  startedAt: number;
  duration: number;
  /** 소실점(화면 중심 기준 u) */
  vpX: number;
  vpY: number;
  /** 퇴장 방향 단위벡터 */
  dirX: number;
  dirY: number;
  /** z=1 에서 소실점으로부터의 횡거리 */
  k: number;
  z0: number;
  zEnd: number;
};

export type FlybyPose = {
  /** 화면 중심 기준 u */
  x: number;
  y: number;
  /** 본체 폭(u) */
  scale: number;
  alpha: number;
  z: number;
};

/** z=1 에서 그려지는 본체 폭(u) */
export const AD_SAT_BASE = 0.55;
/** 이 깊이보다 가까울 때만 도킹 판정(멀리 있는 점을 "도킹"할 수는 없다) */
export const AD_DOCK_Z = 2.2;
/** 카메라 이동 결합 계수 — 1이면 완전 월드 고정, 0이면 화면에 붙음 */
const CAM_COUPLE = 0.9;

export function makeFlyby(
  satId: AdSatellite["id"],
  rand: () => number,
  elapsed: number,
): AdFlyby {
  const ang = rand() * Math.PI * 2;
  // 소실점은 중심 근처 편향(도킹 가능성) + 아래쪽 회피(텔레메트리 바 존)
  const vpR = 0.05 + rand() * 0.23;
  const vpA = rand() * Math.PI * 2;
  return {
    satId,
    startedAt: elapsed,
    duration: 26 + rand() * 8,
    vpX: Math.cos(vpA) * vpR,
    vpY: Math.max(-0.3, Math.min(0.15, Math.sin(vpA) * vpR)),
    dirX: Math.cos(ang),
    dirY: Math.sin(ang),
    k: 0.5 + rand() * 0.4,
    z0: 7 + rand() * 2,
    zEnd: 0.45 + rand() * 0.15,
  };
}

/**
 * 항로 위의 현재 포즈. null = 항로 종료(시간 만료 또는 근접 후 화면 밖 이탈).
 * camDx/Dy: 스폰 시점 대비 카메라(줍스) 이동량(월드 u).
 */
export function flybyPose(
  f: AdFlyby,
  elapsed: number,
  camDx: number,
  camDy: number,
): FlybyPose | null {
  const t = elapsed - f.startedAt;
  if (t < 0 || t > f.duration) return null;
  const z = f.z0 - (f.z0 - f.zEnd) * (t / f.duration);
  const lat = f.k / z;
  const x = f.vpX + f.dirX * lat - (camDx * CAM_COUPLE) / z;
  const y = f.vpY + f.dirY * lat - (camDy * CAM_COUPLE) / z;
  // 근접 구간에서 이미 화면 밖 멀리면 조기 종료(빈 프레임 계산 낭비 방지)
  if (z < 0.7 && Math.hypot(x, y) > 1.6) return null;
  const alpha = Math.min(1, t / 2.5) * (0.45 + 0.55 * (1 - z / f.z0));
  return { x, y, scale: AD_SAT_BASE / z, alpha, z };
}
